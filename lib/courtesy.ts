import { getAccessToken } from '@/lib/auth';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/config';
import { callServerFn } from '@/lib/server-fn';
import { type EventBatch } from '@/lib/events';

const FN_SEARCH = 'b31031154601730d30783809958f5e46ff3e34f2eec8f9cda8cd7358a8156101';
const FN_LINK = '62d3f0a1966c1677137c3679d30aeae1587abdbcc4fbbfb0fff44b8750c9f21e';
const FN_EMAIL = 'f8174769b4b8c45645a8f6acc499c897f41dc5b027fb20f1461b7bb7060425dd';

type Row = Record<string, unknown>;

export type Gate8Customer = {
  id: string;
  name: string;
  email: string;
};

export type CourtesyTicket = {
  id: string;
  code: string;
  holder: string;
  email: string;
  createdAt: string | null;
  batchId: string;
};

export type EmitCourtesyInput = {
  eventId: string;
  batch: EventBatch;
  quantity: number;
  holderName: string;
  holderEmail: string;
  mode: 'standalone' | 'customer';
  customer: Gate8Customer | null;
  sendEmail: boolean;
};

async function headers() {
  const token = await getAccessToken();
  if (!token) throw new Error('Faça login para continuar.');
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

function text(value: unknown) {
  return value == null ? '' : String(value);
}

function asObject(value: unknown): Row | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : null;
}

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

function ticketCode() {
  const hex = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16));
  return hex.join('').toUpperCase();
}

const CANCELLED = new Set([
  'cancelled',
  'canceled',
  'refunded',
  'refund',
  'void',
  'reversed',
  'estornado',
  'chargedback',
]);

function isCourtesyMethod(value: unknown) {
  const method = text(value).trim().toLowerCase();
  return !method || method === 'null' || method === 'courtesy' || method === 'cortesia' || method === 'free';
}

function isLinked(raw: unknown): boolean {
  if (raw === true) return true;
  const root = asObject(raw);
  if (!root) return false;
  const inner = asObject(root.data) ?? asObject(root.result) ?? root;
  const value = inner.linked ?? inner.ok ?? inner.success ?? root.linked;
  return value === true || value === 'true' || value === 1;
}

async function postTickets(payload: Row[]) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/tickets`, {
    method: 'POST',
    headers: {
      ...(await headers()),
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });
  const raw = await response.text();
  const body = raw ? (JSON.parse(raw) as unknown) : null;
  return { ok: response.ok, body };
}

async function insertTickets(
  eventId: string,
  batchId: string,
  quantity: number,
  name: string,
  email: string,
  customerId?: string
) {
  const makeRows = (withOwner: boolean) =>
    Array.from({ length: quantity }, () => ({
      event_id: eventId,
      batch_id: batchId,
      code: ticketCode(),
      holder_name: name,
      holder_email: email || null,
      payment_method: null,
      ...(withOwner && customerId ? { user_id: customerId } : {}),
    }));

  let payload = makeRows(Boolean(customerId));
  let posted = await postTickets(payload);
  if (!posted.ok && customerId) {
    payload = payload.map((row) => {
      const next = { ...row };
      delete next.user_id;
      return next;
    });
    posted = await postTickets(payload);
  }
  if (!posted.ok) {
    const message =
      asObject(posted.body)?.message || asObject(posted.body)?.hint || 'Não foi possível emitir a cortesia.';
    throw new Error(typeof message === 'string' ? message : 'Não foi possível emitir a cortesia.');
  }
  const rows = asRows(posted.body);
  const tickets = rows
    .map((row, index) => ({
      id: text(row.id),
      code: text(row.code) || text(payload[index]?.code),
    }))
    .filter((row) => row.id);
  if (tickets.length === 0) throw new Error('A cortesia foi criada, mas o servidor não devolveu o ingresso.');
  return tickets;
}

function pickCustomers(raw: unknown): Gate8Customer[] {
  const root = asObject(raw);
  const nested = asObject(root?.data) ?? root;
  const list = nested ? nested.customers ?? nested.items ?? nested.users ?? nested.results : raw;
  return asRows(list)
    .map((row) => ({
      id: text(row.id || row.user_id),
      name: text(row.name || row.full_name || row.display_name),
      email: text(row.email),
    }))
    .filter((row) => row.id && (row.name || row.email));
}

export async function searchGate8Customers(eventId: string, query: string): Promise<Gate8Customer[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const raw = await callServerFn<unknown>(FN_SEARCH, { eventId, query: q });
  return pickCustomers(raw);
}

async function bumpSold(batch: EventBatch, quantity: number) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/ticket_batches?id=eq.${encodeURIComponent(batch.id)}`,
    {
      method: 'PATCH',
      headers: {
        ...(await headers()),
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ sold: (batch.sold ?? 0) + quantity }),
    }
  );
  if (!response.ok) {
    throw new Error('Ingresso emitido, mas o estoque do lote não atualizou.');
  }
}

async function attachTicketsToCustomer(ticketIds: string[], customer: Gate8Customer) {
  const fields: Row[] = [
    { user_id: customer.id },
    { created_by: customer.id },
    { owner_id: customer.id },
    { customer_id: customer.id },
    { buyer_id: customer.id },
  ];
  const filter = ticketIds.map((id) => encodeURIComponent(id)).join(',');
  for (const body of fields) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/tickets?id=in.(${filter})`, {
      method: 'PATCH',
      headers: {
        ...(await headers()),
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
    });
    if (response.ok) return true;
  }
  return false;
}

async function linkToWallet(
  eventId: string,
  ticketIds: string[],
  mode: 'standalone' | 'customer',
  customer: Gate8Customer | null
) {
  let linked = false;
  try {
    const raw = await callServerFn<unknown>(FN_LINK, {
      eventId,
      ticketIds,
      mode,
      customerId: mode === 'customer' ? customer?.id : undefined,
      customerEmail: mode === 'customer' ? customer?.email ?? undefined : undefined,
    });
    linked = isLinked(raw);
  } catch {
    linked = false;
  }
  if (mode === 'customer' && customer && !linked) {
    linked = await attachTicketsToCustomer(ticketIds, customer);
  }
  return linked;
}

async function sendTicketEmails(ticketIds: string[]) {
  const results = await Promise.allSettled(
    ticketIds.map((ticketId) => callServerFn(FN_EMAIL, { ticketId }))
  );
  const sent = results.filter((item) => item.status === 'fulfilled').length;
  return { sent, failed: results.length - sent };
}

export async function emitCourtesy(input: EmitCourtesyInput) {
  const name = input.holderName.trim();
  const email = input.holderEmail.trim();
  if (input.mode === 'customer' && !input.customer) {
    throw new Error('Selecione uma conta Gate8.');
  }
  if (!name) throw new Error('Informe o nome do comprador.');
  if (!input.batch.id) throw new Error('Selecione um lote.');
  if (input.quantity < 1) throw new Error('Quantidade inválida.');
  if (input.sendEmail && !email) throw new Error('Informe um e-mail para envio.');
  const remaining = Math.max(0, input.batch.quantity - input.batch.sold);
  if (input.batch.quantity > 0) {
    if (remaining <= 0) throw new Error('Este lote está esgotado.');
    if (input.quantity > remaining) {
      throw new Error(`Só restam ${remaining} ingresso(s) neste lote.`);
    }
  }

  const tickets = await insertTickets(
    input.eventId,
    input.batch.id,
    input.quantity,
    name,
    email,
    input.mode === 'customer' ? input.customer?.id : undefined
  );
  const ids = tickets.map((item) => item.id);
  await bumpSold(input.batch, input.quantity);
  const linked = await linkToWallet(input.eventId, ids, input.mode, input.customer);
  let emailed = 0;
  if (input.sendEmail) {
    const mail = await sendTicketEmails(ids);
    emailed = mail.sent;
    if (mail.failed > 0 && mail.sent === 0) {
      throw new Error('Cortesia emitida, mas o e-mail não saiu.');
    }
  }
  return { count: ids.length, linked, emailed, codes: tickets.map((item) => item.code).filter(Boolean) };
}

export async function fetchCourtesyTickets(eventId: string): Promise<CourtesyTicket[]> {
  const id = encodeURIComponent(eventId);
  const paths = [
    `tickets?select=id,code,holder_name,holder_email,created_at,batch_id,status,payment_method&event_id=eq.${id}&order=created_at.desc&limit=80`,
    `tickets?select=id,code,holder_name,holder_email,created_at,batch_id,status&event_id=eq.${id}&payment_method=is.null&order=created_at.desc&limit=80`,
    `tickets?select=id,code,holder_name,holder_email,created_at,batch_id&event_id=eq.${id}&payment_method=is.null&order=created_at.desc&limit=80`,
  ];
  let rows: Row[] = [];
  let usedPaymentColumn = false;
  for (const path of paths) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: await headers() });
    const raw = await response.text();
    const body = raw ? (JSON.parse(raw) as unknown) : null;
    if (!response.ok) continue;
    rows = asRows(body);
    usedPaymentColumn = path.includes('payment_method') && !path.includes('payment_method=is.null');
    break;
  }
  return rows
    .filter((row) => !CANCELLED.has(text(row.status).trim().toLowerCase()))
    .filter((row) => (usedPaymentColumn ? isCourtesyMethod(row.payment_method) : true))
    .map((row) => ({
      id: text(row.id),
      code: text(row.code),
      holder: text(row.holder_name) || '—',
      email: text(row.holder_email),
      createdAt: row.created_at ? text(row.created_at) : null,
      batchId: text(row.batch_id),
    }));
}
