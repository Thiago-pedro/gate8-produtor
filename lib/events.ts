import { getAccessToken } from '@/lib/auth';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/config';

export type ProducerEvent = {
  id: string;
  name: string;
  slug: string;
  event_date: string | null;
  location: string | null;
  capacity: number | null;
  status: string | null;
  banner_url: string | null;
  is_ended: boolean | null;
  sold: number;
  quantity: number;
};

export type EventBatch = {
  id: string;
  name: string;
  sector: string | null;
  gender: string | null;
  price: number;
  quantity: number;
  sold: number;
  active: boolean | null;
  valid_from: string | null;
  valid_until: string | null;
};

export type EventCheckin = {
  id: string;
  code: string;
  holder: string;
  ticket: string;
  at: string | null;
  status: string;
};

export type ProducerEventDetail = {
  event: {
    id: string;
    name: string;
    slug: string;
    event_date: string | null;
    location: string | null;
    capacity: number | null;
    status: string | null;
    banner_url: string | null;
    description: string | null;
    is_ended: boolean | null;
  };
  batches: EventBatch[];
  sold: number;
  courtesy: number;
  quantity: number;
  validated: number;
  cancelled: number;
  revenue: number;
  token: string | null;
  checkins: EventCheckin[];
};

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
    throw new Error(message || 'Não foi possível carregar os dados do evento.');
  }
  return body as T;
}

async function restPost(path: string, body: unknown) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: {
      ...(await headers()),
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  let parsed: unknown = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      parsed = null;
    }
  }
  if (!response.ok) {
    const message =
      parsed && typeof parsed === 'object' && parsed !== null && 'message' in parsed
        ? String((parsed as { message?: string }).message)
        : null;
    throw new Error(message || 'Não foi possível criar o lote.');
  }
}

async function restPatch(path: string, body: unknown) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      ...(await headers()),
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  let parsed: unknown = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      parsed = null;
    }
  }
  if (!response.ok) {
    const message =
      parsed && typeof parsed === 'object' && parsed !== null && 'message' in parsed
        ? String((parsed as { message?: string }).message)
        : null;
    throw new Error(message || 'Não foi possível salvar o lote.');
  }
}

async function restCount(path: string): Promise<number | null> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      ...(await headers()),
      Prefer: 'count=exact',
      Range: '0-0',
    },
  });
  if (!response.ok) return null;
  const range = response.headers.get('content-range') ?? response.headers.get('Content-Range');
  const total = range?.split('/')[1];
  if (total && total !== '*') {
    const n = Number(total);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

async function restOrEmpty<T>(path: string, fallback: T): Promise<T> {
  try {
    return await rest<T>(path);
  } catch {
    return fallback;
  }
}

function asRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function nested(row: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = row[key];
  if (Array.isArray(value) && value[0] && typeof value[0] === 'object') {
    return value[0] as Record<string, unknown>;
  }
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  return null;
}

function ticketLabel(ticket: Record<string, unknown>, batches: EventBatch[]) {
  const batch = nested(ticket, 'ticket_batches');
  const batchId = text(ticket.batch_id);
  const fromList = batches.find((item) => item.id === batchId);
  const sector = (text(batch?.sector) || fromList?.sector || '').trim();
  const name = (text(batch?.name) || fromList?.name || '').trim();
  if (!name) return sector || 'Ingresso';
  if (!sector) return name;
  const nameNorm = name.toLowerCase();
  const sectorNorm = sector.toLowerCase();
  if (
    nameNorm === sectorNorm ||
    nameNorm.startsWith(`${sectorNorm} `) ||
    nameNorm.startsWith(`${sectorNorm}-`) ||
    nameNorm.includes(sectorNorm)
  ) {
    return name;
  }
  return `${sector} - ${name}`;
}

function displayCode(ticket: Record<string, unknown>) {
  const code = text(ticket.code).replace(/-/g, '');
  if (code) return code.toUpperCase();
  return text(ticket.id).replace(/-/g, '').toUpperCase();
}

function mapTicketCheckin(ticket: Record<string, unknown>, batches: EventBatch[], at: string | null): EventCheckin {
  return {
    id: text(ticket.id),
    code: displayCode(ticket),
    holder: text(ticket.holder_name) || 'Convidado',
    ticket: ticketLabel(ticket, batches),
    at,
    status: text(ticket.status) || 'used',
  };
}

function earliestCheckinByTicket(rows: Record<string, unknown>[]) {
  const times = new Map<string, string>();
  for (const row of rows) {
    const ticketId = text(row.ticket_id);
    const at = text(row.created_at);
    if (!ticketId || !at) continue;
    const previous = times.get(ticketId);
    if (!previous || at < previous) times.set(ticketId, at);
  }
  return times;
}

async function firstRest(paths: string[]): Promise<Record<string, unknown>[]> {
  for (const path of paths) {
    try {
      return asRows(await rest(path));
    } catch {
      // tenta um select menor se a coluna ou o embed não existir
    }
  }
  return [];
}

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function text(value: unknown) {
  return value == null ? '' : String(value);
}

const CANCELLED_STATUSES = [
  'cancelled',
  'canceled',
  'refunded',
  'refund',
  'void',
  'reversed',
  'estornado',
  'chargedback',
];

const CANCELLED_IN = CANCELLED_STATUSES.join(',');

function isOpenEvent(event: { is_ended?: boolean | null; status?: string | null }) {
  if (event.is_ended) return false;
  if (event.status === 'closed' || event.status === 'cancelled' || event.status === 'finished') return false;
  return true;
}

export async function fetchProducerEvents(userId: string): Promise<ProducerEvent[]> {
  const rows = asRows(
    await rest(
      `events?select=id,name,slug,event_date,location,capacity,status,banner_url,is_ended&created_by=eq.${encodeURIComponent(userId)}&order=event_date.desc`
    )
  );

  const events = rows
    .map((row) => ({
      id: text(row.id),
      name: text(row.name),
      slug: text(row.slug),
      event_date: row.event_date ? text(row.event_date) : null,
      location: row.location ? text(row.location) : null,
      capacity: row.capacity == null ? null : num(row.capacity),
      status: row.status ? text(row.status) : null,
      banner_url: row.banner_url ? text(row.banner_url) : null,
      is_ended: Boolean(row.is_ended),
      sold: 0,
      quantity: 0,
    }))
    .filter(isOpenEvent);

  if (events.length === 0) return [];

  const ids = events.map((event) => event.id).join(',');
  const batches = asRows(
    await restOrEmpty(`ticket_batches?select=event_id,sold,quantity&event_id=in.(${ids})`, [])
  );

  const soldByEvent = new Map<string, { sold: number; quantity: number }>();
  for (const batch of batches) {
    const eventId = text(batch.event_id);
    const current = soldByEvent.get(eventId) ?? { sold: 0, quantity: 0 };
    current.sold += num(batch.sold);
    current.quantity += num(batch.quantity);
    soldByEvent.set(eventId, current);
  }

  return events.map((event) => ({
    ...event,
    sold: soldByEvent.get(event.id)?.sold ?? 0,
    quantity: soldByEvent.get(event.id)?.quantity ?? event.capacity ?? 0,
  }));
}

export async function fetchProducerEventDetail(eventId: string): Promise<ProducerEventDetail> {
  const id = encodeURIComponent(eventId);
  const rows = asRows(await rest(`events?select=*&id=eq.${id}`));
  const row = rows[0];
  if (!row) throw new Error('Evento não encontrado.');

  const batches = (
    await firstRest([
      `ticket_batches?select=id,name,sector,gender,price,quantity,sold,active,valid_from,valid_until&event_id=eq.${id}&order=sector.asc,created_at.asc`,
      `ticket_batches?select=id,name,sector,price,quantity,sold,active,valid_from,valid_until&event_id=eq.${id}&order=sector.asc,created_at.asc`,
    ])
  ).map((batch) => ({
    id: text(batch.id),
    name: text(batch.name) || 'Lote',
    sector: batch.sector ? text(batch.sector) : null,
    gender: batch.gender ? text(batch.gender) : null,
    price: num(batch.price),
    quantity: num(batch.quantity),
    sold: num(batch.sold),
    active: batch.active == null ? true : Boolean(batch.active),
    valid_from: batch.valid_from ? text(batch.valid_from) : null,
    valid_until: batch.valid_until ? text(batch.valid_until) : null,
  }));

  const sold = batches.reduce((sum, batch) => sum + batch.sold, 0);
  const quantity = batches.reduce((sum, batch) => sum + batch.quantity, 0);
  const revenue = batches.reduce((sum, batch) => sum + batch.sold * batch.price, 0);

  const usedFilter = encodeURIComponent('(checked_in_at.not.is.null,status.eq.used)');
  const ticketSelects = [
    'id,code,holder_name,status,checked_in_at,batch_id,ticket_batches(name,sector)',
    'id,code,holder_name,status,checked_in_at,batch_id',
    'id,holder_name,status,checked_in_at,batch_id',
  ];

  const [
    usedTickets,
    checkinRows,
    cancelledRows,
    courtesyAll,
    paidAll,
    cancelledPaid,
    cancelledCourtesy,
    cancelledByOrder,
  ] = await Promise.all([
    firstRest(
      ticketSelects.flatMap((select) => [
        `tickets?select=${select}&event_id=eq.${id}&or=${usedFilter}&order=checked_in_at.desc&limit=200`,
        `tickets?select=${select}&event_id=eq.${id}&checked_in_at=not.is.null&order=checked_in_at.desc&limit=200`,
      ])
    ),
    firstRest([
      `checkins?select=id,ticket_id,created_at,tickets(${ticketSelects[0]})&event_id=eq.${id}&order=created_at.desc&limit=200`,
      `checkins?select=id,ticket_id,created_at,tickets(${ticketSelects[1]})&event_id=eq.${id}&order=created_at.desc&limit=200`,
      `checkins?select=id,ticket_id,created_at&event_id=eq.${id}&order=created_at.desc&limit=200`,
    ]),
    firstRest([
      `tickets?select=id&event_id=eq.${id}&status=in.(${CANCELLED_IN})&limit=1000`,
      `tickets?select=id&event_id=eq.${id}&status=eq.cancelled&limit=1000`,
    ]),
    restCount(`tickets?select=id&event_id=eq.${id}&payment_method=is.null`),
    restCount(`tickets?select=id&event_id=eq.${id}&payment_method=not.is.null`),
    restCount(
      `tickets?select=id&event_id=eq.${id}&payment_method=not.is.null&status=in.(${CANCELLED_IN})`
    ),
    restCount(
      `tickets?select=id&event_id=eq.${id}&payment_method=is.null&status=in.(${CANCELLED_IN})`
    ),
    restCount(
      `tickets?select=id&event_id=eq.${id}&payment_method=not.is.null&purchase_orders.status=in.(${CANCELLED_IN})`
    ),
  ]);

  const firstScan = earliestCheckinByTicket(checkinRows);

  const checkins = usedTickets
    .map((ticket) => {
      const ticketId = text(ticket.id);
      const at = firstScan.get(ticketId) || (ticket.checked_in_at ? text(ticket.checked_in_at) : null);
      return mapTicketCheckin(ticket, batches, at);
    })
    .sort((left, right) => (right.at || '').localeCompare(left.at || ''));

  const cancelled = cancelledRows.length;
  const validated = usedTickets.length;
  const courtesy =
    courtesyAll != null
      ? Math.max(0, courtesyAll - (cancelledCourtesy ?? 0))
      : 0;
  const refundedPaid =
    cancelledPaid != null || cancelledByOrder != null
      ? Math.max(cancelledPaid ?? 0, cancelledByOrder ?? 0)
      : cancelled;
  const soldCount =
    paidAll != null
      ? Math.max(0, paidAll - refundedPaid)
      : Math.max(0, sold - courtesy - cancelled);

  const tokens = asRows(
    await restOrEmpty(
      `event_gate_tokens?select=token,created_at&event_id=eq.${id}&order=created_at.desc&limit=1`,
      []
    )
  );

  return {
    event: {
      id: text(row.id),
      name: text(row.name),
      slug: text(row.slug),
      event_date: row.event_date ? text(row.event_date) : null,
      location: row.location ? text(row.location) : null,
      capacity: row.capacity == null ? null : num(row.capacity),
      status: row.status ? text(row.status) : null,
      banner_url: row.banner_url ? text(row.banner_url) : null,
      description: row.description ? text(row.description) : null,
      is_ended: Boolean(row.is_ended),
    },
    batches,
    sold: soldCount,
    courtesy,
    quantity: quantity || num(row.capacity),
    validated,
    cancelled,
    revenue,
    token: tokens[0]?.token ? text(tokens[0].token) : null,
    checkins,
  };
}

export const BATCH_GENDERS = [
  { id: 'unisex', label: 'Unissex (entrada)' },
  { id: 'masculino', label: 'Masculino' },
  { id: 'feminino', label: 'Feminino' },
] as const;

export type BatchGender = (typeof BATCH_GENDERS)[number]['id'];

export function batchTicketName(batch: EventBatch) {
  if (batch.sector && batch.name.startsWith(`${batch.sector} - `)) {
    return batch.name.slice(batch.sector.length + 3);
  }
  return batch.name;
}

export function asBatchGender(value: string | null): BatchGender {
  if (value === 'masculino' || value === 'feminino' || value === 'unisex') return value;
  return 'unisex';
}

function batchFields(input: {
  sector: string;
  label: string;
  gender: BatchGender;
  price: number;
  quantity: number;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
}) {
  const sector = input.sector.trim();
  const label = input.label.trim();
  if (!sector) throw new Error('Informe o setor.');
  if (!label) throw new Error('Informe o nome do ingresso.');
  if (!Number.isFinite(input.price) || input.price < 0) {
    throw new Error('Informe um preço válido.');
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 0) {
    throw new Error('Informe a quantidade.');
  }
  return {
    sector,
    name: `${sector} - ${label}`,
    gender: input.gender,
    price: input.price,
    quantity: input.quantity,
    valid_from: input.validFrom,
    valid_until: input.validUntil,
    active: input.active,
  };
}

export async function createTicketBatch(input: {
  eventId: string;
  sector: string;
  label: string;
  gender: BatchGender;
  price: number;
  quantity: number;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
}) {
  const payload = { event_id: input.eventId, ...batchFields(input) };
  try {
    await restPost('ticket_batches', payload);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : '';
    if (/ticket_type/i.test(message)) {
      await restPost('ticket_batches', { ...payload, ticket_type: input.gender });
      return;
    }
    throw caught;
  }
}

export async function updateTicketBatch(
  batchId: string,
  input: {
    sector: string;
    label: string;
    gender: BatchGender;
    price: number;
    quantity: number;
    validFrom: string | null;
    validUntil: string | null;
    active: boolean;
  }
) {
  const payload = batchFields(input);
  const path = `ticket_batches?id=eq.${encodeURIComponent(batchId)}`;
  try {
    await restPatch(path, payload);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : '';
    if (/ticket_type/i.test(message)) {
      await restPatch(path, { ...payload, ticket_type: input.gender });
      return;
    }
    throw caught;
  }
}
