import { callServerFn } from '@/lib/server-fn';

const FN_SEARCH = '9db7df87d976a57b56af85e0ed68ddaa0f337c840d18877aa75248eaf9109d0b';
const FN_REFUND = 'ae303747eb272924bb611cd1a75a661062c18c09043383dfaa6f77a8fa804ed9';
const FN_LOGS = '514a93b7d0f712630ee5d12065d53c8992c804770ee7b78c827fc099cb0fff9f';

type Row = Record<string, unknown>;

export type RefundItem = {
  buyer: string;
  purchaseCode: string | null;
  createdAt: string | null;
  method: string;
  amount: number;
  ticketCount: number;
  freedTables: number;
  gatewayMessage: string | null;
};

export type RefundReport = {
  totalAmount: number;
  totalTickets: number;
  count: number;
  refunds: RefundItem[];
};

export type RefundSearchHit = {
  key: string;
  kind: 'purchase' | 'tickets';
  purchaseId: string | null;
  ticketIds: string[];
  buyer: string;
  purchaseCode: string | null;
  totalAmount: number;
  method: string | null;
  viaPagarme: boolean;
  activeTickets: number;
  ticketCount: number;
  createdAt: string | null;
};

export type RefundResult = {
  cancelled: number;
  message: string;
};

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function text(value: unknown) {
  return value == null ? '' : String(value);
}

export function refundMethodLabel(method: string) {
  if (method === 'credit_card') return 'Cartão';
  if (method === 'pix') return 'PIX';
  if (method === 'debit') return 'Débito';
  if (method === 'cash') return 'Dinheiro';
  return method || '—';
}

function asObject(value: unknown): Row | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Row;
  return null;
}

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

function ids(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item)).filter(Boolean);
}

function pickResults(raw: unknown): Row[] {
  const root = asObject(raw);
  if (!root) return asRows(raw);
  if (Array.isArray(root.results)) return asRows(root.results);
  const nested = asObject(root.data);
  if (nested && Array.isArray(nested.results)) return asRows(nested.results);
  return [];
}

function mapHit(row: Row): RefundSearchHit {
  const ticketIds = ids(row.ticket_ids);
  const purchaseId = row.purchase_id ? text(row.purchase_id) : null;
  const kind = text(row.kind) === 'purchase' || purchaseId ? 'purchase' : 'tickets';
  const ticketCount = num(row.ticket_count) || ticketIds.length;
  return {
    key: kind === 'purchase' && purchaseId ? purchaseId : ticketIds.join(',') || text(row.created_at),
    kind,
    purchaseId,
    ticketIds,
    buyer: text(row.buyer_name) || '—',
    purchaseCode: row.purchase_code ? text(row.purchase_code) : null,
    totalAmount: num(row.total_amount),
    method: row.payment_method ? text(row.payment_method) : null,
    viaPagarme: Boolean(row.pagarme_charge_id),
    activeTickets: num(row.active_tickets),
    ticketCount,
    createdAt: row.created_at ? text(row.created_at) : null,
  };
}

export async function searchRefunds(eventId: string, query: string): Promise<RefundSearchHit[]> {
  const raw = await callServerFn<unknown>(FN_SEARCH, { event_id: eventId, query: query.trim() });
  return pickResults(raw).map(mapHit);
}

export async function executeRefund(eventId: string, hit: RefundSearchHit): Promise<RefundResult> {
  const payload =
    hit.kind === 'purchase' && hit.purchaseId
      ? { event_id: eventId, purchase_id: hit.purchaseId }
      : { event_id: eventId, ticket_ids: hit.ticketIds };
  const raw = asObject(await callServerFn<unknown>(FN_REFUND, payload)) ?? {};
  const nested = asObject(raw.data) ?? raw;
  const refund = asObject(nested.refund) ?? {};
  const cancelled = num(nested.cancelled);
  const attempted = Boolean(refund.attempted);
  const ok = Boolean(refund.ok);
  const extra = attempted
    ? ok
      ? 'Estorno enviado ao Pagar.me.'
      : `Tickets cancelados, mas Pagar.me falhou: ${text(refund.message)}`
    : '';
  return {
    cancelled,
    message: `${cancelled} ingresso(s) cancelado(s). ${extra}`.trim(),
  };
}

export async function fetchRefundReport(eventId: string): Promise<RefundReport> {
  const raw = await callServerFn<Row>(FN_LOGS, { event_id: eventId });
  const rows = Array.isArray(raw.refunds) ? (raw.refunds as Row[]) : [];
  const refunds = rows.map((row) => ({
    buyer: text(row.buyer_name) || '—',
    purchaseCode: row.purchase_code ? text(row.purchase_code) : null,
    createdAt: row.created_at ? text(row.created_at) : null,
    method: text(row.payment_method),
    amount: num(row.amount),
    ticketCount: num(row.ticket_count),
    freedTables: num(row.freed_tables),
    gatewayMessage: row.gateway_message ? text(row.gateway_message) : null,
  }));
  return {
    totalAmount: num(raw.total_amount),
    totalTickets: num(raw.total_tickets),
    count: num(raw.count) || refunds.length,
    refunds,
  };
}
