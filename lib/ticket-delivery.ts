import { getAccessToken } from '@/lib/auth';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/config';
import { callServerFn } from '@/lib/server-fn';

const FN_SEND = 'd3e29e39ddd409da0af9c8b4b2ffa11ed7ae230f1db063a7f3359246e6b4ba1a';
const FN_ARCHIVE = 'a63cd80b9f294dab152ea85b18cf5a675b0f635136cb63e584f4f7583c27ef51';
const FN_TRANSFERS = '5b03e900547ac78aeebc5767f22e8a199540e78b7dc8f8bf945b12f8bb61378d';

type Row = Record<string, unknown>;

export type DeliveryTicket = {
  id: string;
  code: string;
  status: string;
  kind: 'full' | 'half';
  checkedInAt: string | null;
};

export type DeliveryGuest = {
  id: string;
  name: string;
  email: string;
  custom: string | null;
  emailSentAt: string | null;
  lastViewedAt: string | null;
  viewedDevice: string | null;
  creationSource: string | null;
  transferredOut: number;
  transferredIn: number;
  tickets: DeliveryTicket[];
};

export type TicketTransfer = {
  id: string;
  fromName: string;
  fromEmail: string;
  toName: string;
  toEmail: string;
  oldCode: string;
  newCode: string;
  ticketName: string;
  createdAt: string;
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

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...(await headers()), ...(init?.headers ?? {}) },
  });
  const raw = await response.text();
  const body = raw ? (JSON.parse(raw) as unknown) : null;
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && body !== null && 'message' in body
        ? String((body as { message?: string }).message)
        : null;
    throw new Error(message || 'Não foi possível concluir a operação.');
  }
  return body as T;
}

function mapTicket(row: Row): DeliveryTicket {
  const kind = text(row.ticket_delivery_kind) === 'half' ? 'half' : 'full';
  return {
    id: text(row.id),
    code: text(row.code),
    status: text(row.status),
    kind,
    checkedInAt: row.checked_in_at ? text(row.checked_in_at) : null,
  };
}

function mapGuest(row: Row): DeliveryGuest {
  const tickets = asRows(row.tickets).map(mapTicket);
  return {
    id: text(row.id),
    name: text(row.name) || 'Participante',
    email: text(row.email),
    custom: row.custom_field_value ? text(row.custom_field_value) : null,
    emailSentAt: row.email_sent_at ? text(row.email_sent_at) : null,
    lastViewedAt: row.last_viewed_at ? text(row.last_viewed_at) : null,
    viewedDevice: row.viewed_device ? text(row.viewed_device) : null,
    creationSource: row.creation_source ? text(row.creation_source) : null,
    transferredOut: num(row.transferred_out_count),
    transferredIn: num(row.transferred_in_count),
    tickets,
  };
}

export function activeTickets(guest: DeliveryGuest) {
  return guest.tickets.filter((ticket) => ticket.status !== 'cancelled');
}

export function guestCounts(guest: DeliveryGuest) {
  const active = activeTickets(guest);
  const full = active.filter((ticket) => ticket.kind === 'full').length;
  const half = active.filter((ticket) => ticket.kind === 'half').length;
  const validated = active.filter((ticket) => ticket.status === 'used').length;
  const current = full + half;
  const initial = Math.max(0, current + guest.transferredOut - guest.transferredIn);
  return { full, half, validated, current, initial };
}

export async function fetchDeliveryGuests(eventId: string): Promise<DeliveryGuest[]> {
  const id = encodeURIComponent(eventId);
  const rows = asRows(
    await rest(
      `ticket_delivery_guests?select=id,name,email,custom_field_value,email_sent_at,last_viewed_at,viewed_device,creation_source,transferred_out_count,transferred_in_count,created_at,tickets(id,code,status,checked_in_at,ticket_delivery_kind)&event_id=eq.${id}&archived_at=is.null&order=created_at.desc`
    )
  );
  return rows.map(mapGuest);
}

export async function createDeliveryGuest(input: {
  eventId: string;
  name: string;
  email: string;
  full: number;
  half: number;
  custom: string;
}) {
  await rest('rpc/create_ticket_delivery_guest', {
    method: 'POST',
    body: JSON.stringify({
      _event_id: input.eventId,
      _name: input.name.trim(),
      _email: input.email.trim(),
      _full_count: input.full,
      _half_count: input.half,
      _custom_field_value: input.custom.trim() || null,
    }),
  });
}

export async function addDeliveryTickets(guestId: string, kind: 'full' | 'half', quantity: number) {
  await rest('rpc/add_ticket_delivery_tickets', {
    method: 'POST',
    body: JSON.stringify({ _guest_id: guestId, _kind: kind, _quantity: quantity }),
  });
}

export async function cancelDeliveryTicket(guestId: string, ticketId: string) {
  await rest('rpc/cancel_ticket_delivery_tickets', {
    method: 'POST',
    body: JSON.stringify({ _guest_id: guestId, _ticket_ids: [ticketId] }),
  });
}

export async function sendDeliveryInvite(guestId: string) {
  await callServerFn(FN_SEND, { guestId });
}

export async function archiveDeliveryGuest(guestId: string) {
  await callServerFn(FN_ARCHIVE, { guestId });
}

async function eventTicketIndex(eventId: string) {
  const ids = new Set<string>();
  const codes = new Set<string>();
  const id = encodeURIComponent(eventId);
  let from = 0;
  for (;;) {
    const page = asRows(
      await rest<unknown>(`tickets?select=id,code&event_id=eq.${id}&offset=${from}&limit=1000`)
    );
    for (const row of page) {
      const ticketId = text(row.id);
      const code = text(row.code);
      if (ticketId) ids.add(ticketId);
      if (code) codes.add(code);
    }
    if (page.length < 1000) break;
    from += 1000;
  }
  return { ids, codes };
}

function transferBelongsToEvent(
  row: Row,
  eventId: string,
  ticketIds: Set<string>,
  codes: Set<string>
) {
  const rowEvent = text(row.eventId ?? row.event_id);
  if (rowEvent) return rowEvent === eventId;
  const ticketId = text(
    row.ticketId ?? row.ticket_id ?? row.newTicketId ?? row.new_ticket_id ?? row.oldTicketId ?? row.old_ticket_id
  );
  const oldCode = text(row.oldCode ?? row.old_code);
  const newCode = text(row.newCode ?? row.new_code);
  if (ticketId && ticketIds.has(ticketId)) return true;
  if (oldCode && codes.has(oldCode)) return true;
  if (newCode && codes.has(newCode)) return true;
  return false;
}

export async function fetchTicketTransfers(eventId: string): Promise<TicketTransfer[]> {
  const [raw, index] = await Promise.all([
    callServerFn<unknown>(FN_TRANSFERS, { eventId }),
    eventTicketIndex(eventId),
  ]);
  const root = raw && typeof raw === 'object' ? (raw as Row) : {};
  const nested = root.data && typeof root.data === 'object' ? (root.data as Row) : root;
  const list = asRows(nested.transfers ?? nested.items ?? nested).filter((row) =>
    transferBelongsToEvent(row, eventId, index.ids, index.codes)
  );
  return list.map((row) => ({
    id: text(row.id),
    fromName: text(row.fromName ?? row.from_name),
    fromEmail: text(row.fromEmail ?? row.from_email),
    toName: text(row.toName ?? row.to_name),
    toEmail: text(row.toEmail ?? row.to_email),
    oldCode: text(row.oldCode ?? row.old_code),
    newCode: text(row.newCode ?? row.new_code),
    ticketName: text(row.ticketName ?? row.ticket_name),
    createdAt: text(
      row.acceptedAt ??
        row.accepted_at ??
        row.createdAt ??
        row.created_at ??
        row.transferredAt ??
        row.transferred_at ??
        row.completedAt ??
        row.completed_at
    ),
  }));
}
