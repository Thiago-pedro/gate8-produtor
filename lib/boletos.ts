import { callServerFn } from '@/lib/server-fn';

/** getEventBoletoFinancials — leitura do produtor dono do evento ou administrador. */
const FN_EVENT_BOLETOS =
  'a5f3723dfe163f48d0d7bb44ccac4f1a08d2937cb7ab58fd1af1150be7fccc20';

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
