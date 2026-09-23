import { getAccessToken, getAuthUser } from '@/lib/auth';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/config';
import { fetchEventFinance } from '@/lib/finance';
import { callServerFn } from '@/lib/server-fn';

const FN_SUMMARY = '464320d1d37b58f7e9c38b5e6cf3886c7720f7be44ea5ad55602e677f0d690bf';

type Row = Record<string, unknown>;

export type WithdrawalRequest = {
  id: string;
  status: string;
  amountNet: number;
  createdAt: string | null;
  paidAt: string | null;
  notes: string | null;
};

export type WithdrawalSummary = {
  gross: number;
  fees: number;
  serviceFees: number;
  bankFees: number;
  net: number;
  available: number;
  withdrawnPaid: number;
  hasPending: boolean;
  producerId: string | null;
  requests: WithdrawalRequest[];
};

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function text(value: unknown) {
  return value == null ? '' : String(value);
}

async function headers() {
  const token = await getAccessToken();
  if (!token) throw new Error('Entre na conta de produtor para continuar.');
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function rest<T>(path: string): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: await headers(),
  });
  const raw = await response.text();
  const body = raw ? (JSON.parse(raw) as unknown) : null;
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && body !== null && 'message' in body
        ? String((body as { message?: string }).message)
        : null;
    throw new Error(message || 'Não foi possível carregar as retiradas.');
  }
  return body as T;
}

function money(value: number) {
  return Number(value.toFixed(2));
}

function asObject(value: unknown): Row | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Row;
  return null;
}

function summaryRow(raw: unknown): Row {
  const root = asObject(raw);
  if (!root) return {};
  const nested = asObject(root.data) ?? asObject(root.result);
  if (nested && (nested.gross != null || nested.net != null || nested.serviceFees != null)) {
    return nested;
  }
  return root;
}

function amount(row: Row, keys: string[]) {
  for (const key of keys) {
    if (row[key] == null || row[key] === '') continue;
    const n = Number(row[key]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

function mapRequest(row: Row): WithdrawalRequest {
  return {
    id: text(row.id),
    status: text(row.status) || 'pending',
    amountNet: num(row.amount_net),
    createdAt: row.created_at ? text(row.created_at) : null,
    paidAt: row.paid_at ? text(row.paid_at) : null,
    notes: row.notes ? text(row.notes) : null,
  };
}

export function parseWithdrawAmount(value: string) {
  return Number(value.replace(/\./g, '').replace(',', '.'));
}

export function maskWithdrawAmount(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return (Number(digits) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function withdrawalStatusLabel(status: string) {
  if (status === 'paid') return 'Pago';
  if (status === 'rejected') return 'Rejeitado';
  return 'Pendente';
}

export async function fetchWithdrawalSummary(eventId: string): Promise<WithdrawalSummary> {
  const encoded = encodeURIComponent(eventId);
  const [eventRows, requestRows, summaryRaw, finance] = await Promise.all([
    rest<Row[]>(`events?select=created_by&id=eq.${encoded}`),
    rest<Row[]>(
      `withdrawal_requests?select=id,status,amount_net,amount_gross,amount_fees,created_at,paid_at,notes&event_id=eq.${encoded}&order=created_at.desc`
    ),
    callServerFn<unknown>(FN_SUMMARY, { eventId }).catch(() => null),
    fetchEventFinance(eventId).catch(() => null),
  ]);

  const summary = summaryRow(summaryRaw);
  const requests = asRows(requestRows).map(mapRequest);
  const withdrawnPaid = requests
    .filter((item) => item.status === 'paid')
    .reduce((sum, item) => sum + item.amountNet, 0);
  const reserved = requests
    .filter((item) => item.status !== 'rejected')
    .reduce((sum, item) => sum + item.amountNet, 0);

  const financeGate8 = finance ? finance.totals.serviceFee : null;
  const financeBank = finance ? finance.totals.bankFee : null;
  const fromFnGate8 = amount(summary, ['serviceFees', 'service_fees', 'gate8', 'gate8_fee']);
  const fromFnBank = amount(summary, ['bankFees', 'bank_fees', 'pagarme', 'pagarme_fee']);
  const hasSplit = (fromFnGate8 ?? 0) > 0 && (fromFnBank ?? 0) > 0;

  const gross =
    amount(summary, ['gross', 'amount_gross']) ??
    (finance ? finance.totals.gross : 0);
  const serviceFees = hasSplit ? (fromFnGate8 ?? 0) : (financeGate8 ?? fromFnGate8 ?? 0);
  const bankFees = hasSplit ? (fromFnBank ?? 0) : (financeBank ?? fromFnBank ?? 0);
  const net = money(gross - serviceFees - bankFees);
  const fees = money(serviceFees + bankFees);

  return {
    gross: money(gross),
    fees,
    serviceFees: money(serviceFees),
    bankFees: money(bankFees),
    net,
    available: money(Math.max(0, net - reserved)),
    withdrawnPaid: money(withdrawnPaid),
    hasPending: requests.some((item) => item.status === 'pending'),
    producerId: eventRows[0]?.created_by ? text(eventRows[0].created_by) : null,
    requests,
  };
}

export async function requestWithdrawal(input: {
  eventId: string;
  amount: number;
  notes: string;
  summary: WithdrawalSummary;
}) {
  const user = await getAuthUser();
  if (!user?.id) throw new Error('Entre na conta de produtor para continuar.');
  if (input.summary.producerId && input.summary.producerId !== user.id) {
    throw new Error('Apenas o produtor deste evento pode solicitar retirada.');
  }
  const response = await fetch(`${SUPABASE_URL}/rest/v1/withdrawal_requests`, {
    method: 'POST',
    headers: {
      ...(await headers()),
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      event_id: input.eventId,
      producer_id: user.id,
      amount_gross: input.summary.gross,
      amount_fees: input.summary.fees,
      amount_net: Number(input.amount.toFixed(2)),
      notes: input.notes.trim() || null,
    }),
  });
  const raw = await response.text();
  if (!response.ok) {
    let message = 'Não foi possível enviar o pedido de retirada.';
    try {
      const body = raw ? (JSON.parse(raw) as { message?: string }) : null;
      if (body?.message) message = body.message;
    } catch {
      // keep default
    }
    throw new Error(message);
  }
}
