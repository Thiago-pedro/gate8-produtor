import { callOwnerServerFn, callServerFn } from '@/lib/server-fn';
import { assertEventPermission } from '@/lib/team';

/** getEventBoletoFinancials — resumo financeiro (já usado no Manager). */
const FN_EVENT_BOLETOS =
  'a5f3723dfe163f48d0d7bb44ccac4f1a08d2937cb7ab58fd1af1150be7fccc20';
/** getEventBoletos — compras/parcelas para gestão e exclusão. */
const FN_EVENT_BOLETO_PURCHASES =
  '74ecd33e840b560aa0866cac851935c5abf4856cd3c87d65194ae5596858a44c';
/** getEventBoletoCancellationCount */
const FN_BOLETO_CANCELLED =
  '5be33608c3ae7afac8724376ceef87d4ab5527c007f778574044e38d8b1c49f5';
/** deleteEventClientBoletos */
const FN_DELETE_BOLETOS =
  '5d1edb13a8d901765da099e976dc97ce2da4506e831ca37e9ea7babd0635f4f2';

export type BoletoSale = {
  id: string;
  intentId: string;
  buyer: string;
  createdAt: string | null;
  /** Valores já em reais. Não dividir por 100. */
  gross: number;
  paid: number;
  fees: number;
  net: number;
  generated: number;
  paidCount: number;
  ticketCount: number;
  feeDescription: string | null;
};

export type BoletoMovement = {
  type: 'issue' | 'paid';
  at: string;
  amount: number;
  fees: number;
  count: number;
  buyer: string;
  purchaseId: string;
};

export type EventBoletos = {
  enabled: boolean;
  rows: BoletoSale[];
  movements: BoletoMovement[];
  materializedIds: string[];
  totals: {
    gross: number;
    paid: number;
    fees: number;
    net: number;
    generated: number;
  };
};

export type BoletoInstallment = {
  id: string;
  number: number;
  status: string;
  paidAt: string | null;
  amountCents: number;
};

export type BoletoPurchase = {
  id: string;
  clientId: string;
  buyer: string;
  email: string;
  accountName: string;
  cpf: string;
  phone: string;
  status: string;
  installmentCount: number;
  installments: BoletoInstallment[];
};

export type BoletoClientGroup = {
  clientId: string;
  name: string;
  email: string;
  purchases: BoletoPurchase[];
};

function asObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function num(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

export function boletoHistoryVisible(report: EventBoletos | null) {
  return Boolean(report && (report.enabled || report.rows.length > 0));
}

export async function fetchEventBoletos(eventId: string): Promise<EventBoletos> {
  await assertEventPermission(eventId, 'boletos');
  const raw = await callServerFn<unknown>(FN_EVENT_BOLETOS, { eventId });
  const envelope = asObject(raw);
  const body = asObject(envelope?.data) ?? envelope;
  if (!body || !Array.isArray(body.rows)) {
    throw new Error('Não foi possível carregar os boletos deste evento.');
  }

  const rows = body.rows.map((item) => {
    const row = asObject(item) ?? {};
    return {
      id: text(row.id),
      intentId: text(row.intentId),
      buyer: text(row.buyer).trim() || '—',
      createdAt: text(row.createdAt) || null,
      gross: num(row.gross),
      paid: num(row.paid),
      fees: num(row.fees),
      net: num(row.net),
      generated: num(row.generated),
      paidCount: num(row.paidCount),
      ticketCount: num(row.ticketCount),
      feeDescription: text(row.feeDescription).trim() || null,
    } satisfies BoletoSale;
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.gross += row.gross;
      acc.paid += row.paid;
      acc.fees += row.fees;
      acc.net += row.net;
      acc.generated += row.generated;
      return acc;
    },
    { gross: 0, paid: 0, fees: 0, net: 0, generated: 0 }
  );

  const materializedIds = Array.isArray(body.materializedIds)
    ? body.materializedIds.map((id) => text(id)).filter(Boolean)
    : [];

  return {
    enabled: Boolean(body.enabled),
    rows,
    movements: parseBoletoMovements(body.movements),
    materializedIds,
    totals,
  };
}

function parseBoletoMovements(value: unknown): BoletoMovement[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asObject(item);
    if (!row) return [];
    const kind = text(row.type ?? row.kind).toLowerCase();
    const type: BoletoMovement['type'] | null = /paid|compens|liquid|settled|quitad/.test(kind)
      ? 'paid'
      : /issue|emiss|gerad|created|fee/.test(kind)
        ? 'issue'
        : null;
    const at = text(row.occurredAt ?? row.occurred_at ?? row.paidAt ?? row.paid_at ?? row.createdAt ?? row.created_at);
    if (!type || !at) return [];
    return [
      {
        type,
        at,
        amount: num(row.amount ?? row.paid ?? row.gross),
        fees: num(row.fees ?? row.fee),
        count: num(row.count ?? row.generated ?? row.paidCount) || 1,
        buyer: text(row.buyer).trim(),
        purchaseId: text(row.purchaseId ?? row.purchase_id ?? row.id),
      },
    ];
  });
}

function installmentPaid(row: BoletoInstallment) {
  return row.status === 'paid' || Boolean(row.paidAt);
}

function mapInstallment(value: unknown): BoletoInstallment | null {
  const row = asObject(value);
  if (!row) return null;
  return {
    id: text(row.id),
    number: num(row.number),
    status: text(row.status).toLowerCase(),
    paidAt: text(row.paidAt ?? row.paid_at) || null,
    amountCents: num(row.amountCents ?? row.amount_cents),
  };
}

function mapPurchase(value: unknown): BoletoPurchase | null {
  const row = asObject(value);
  if (!row) return null;
  const id = text(row.id);
  if (!id) return null;
  const installments = Array.isArray(row.installments)
    ? row.installments.map(mapInstallment).filter((item): item is BoletoInstallment => Boolean(item))
    : [];
  return {
    id,
    clientId: text(row.clientId ?? row.client_id) || id,
    buyer: text(row.buyer).trim() || '—',
    email: text(row.email).trim(),
    accountName: text(row.accountName ?? row.account_name).trim(),
    cpf: text(row.cpf).trim(),
    phone: text(row.phone).trim(),
    status: text(row.status).toLowerCase(),
    installmentCount: num(row.installmentCount ?? row.installment_count) || installments.length,
    installments,
  };
}

export function purchaseCanDelete(purchase: BoletoPurchase) {
  if (purchase.status === 'materialized') return false;
  return !purchase.installments.some(installmentPaid);
}

export function clientDeletablePurchases(group: BoletoClientGroup) {
  return group.purchases.filter(purchaseCanDelete);
}

export async function fetchBoletoCancellationCount(eventId: string): Promise<number> {
  await assertEventPermission(eventId, 'boletos');
  const raw = await callServerFn<unknown>(FN_BOLETO_CANCELLED, { eventId });
  const envelope = asObject(raw);
  const body = asObject(envelope?.data) ?? envelope;
  if (typeof raw === 'number') return raw;
  if (typeof body === 'number') return body;
  if (body && typeof body.count === 'number') return body.count;
  if (body && typeof body.cancelled === 'number') return body.cancelled;
  if (typeof envelope?.result === 'number') return envelope.result as number;
  const n = num(body?.count ?? body?.cancelled ?? envelope?.count);
  return n;
}

export async function fetchEventBoletoClients(eventId: string): Promise<BoletoClientGroup[]> {
  await assertEventPermission(eventId, 'boletos');
  const raw = await callServerFn<unknown>(FN_EVENT_BOLETO_PURCHASES, { eventId });
  const envelope = asObject(raw);
  const body = asObject(envelope?.data) ?? envelope;
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(body)
      ? body
      : Array.isArray(body?.purchases)
        ? body.purchases
        : Array.isArray(body?.rows)
          ? body.rows
          : Array.isArray(envelope?.purchases)
            ? envelope.purchases
            : [];
  const purchases = list.map(mapPurchase).filter((item): item is BoletoPurchase => Boolean(item));
  const groups = new Map<string, BoletoClientGroup>();
  for (const purchase of purchases) {
    const current = groups.get(purchase.clientId) ?? {
      clientId: purchase.clientId,
      name: purchase.buyer,
      email: purchase.email,
      purchases: [],
    };
    if (!current.name || current.name === '—') current.name = purchase.buyer;
    if (!current.email) current.email = purchase.email;
    current.purchases.push(purchase);
    groups.set(purchase.clientId, current);
  }
  return [...groups.values()].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
}

export async function deleteEventClientBoletos(eventId: string, purchaseIds: string[]) {
  const ids = [...new Set(purchaseIds.map((id) => id.trim()).filter(Boolean))].slice(0, 20);
  if (ids.length === 0) throw new Error('Selecione ao menos uma compra para excluir.');
  const raw = await callOwnerServerFn<unknown>(eventId, FN_DELETE_BOLETOS, {
    eventId,
    purchaseIds: ids,
  });
  const envelope = asObject(raw);
  const body = asObject(envelope?.data) ?? envelope ?? {};
  const failures = Array.isArray(body.providerFailures)
    ? body.providerFailures.map((item) => text(item)).filter(Boolean)
    : [];
  return { providerFailures: failures };
}
