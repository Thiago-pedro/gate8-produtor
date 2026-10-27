import { getAccessToken, getAuthUser } from '@/lib/auth';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/config';

import {
  eventIsSharedAvailable,
  permissionAllowed,
  TEAM_PERMISSIONS,
  normalizeEmail,
  type TeamPermission,
  type TeamStatus,
} from '@/lib/team-access';

export type TeamMember = {
  id: string;
  eventId: string;
  userId: string | null;
  email: string;
  name: string;
  invitedBy: string;
  status: TeamStatus;
  permissions: Record<string, boolean>;
  createdAt: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
};

const MEMBER_COLUMNS =
  'id,event_id,user_id,email,invitee_name,invited_by,role,status,permissions,created_at,accepted_at,revoked_at';

type Row = Record<string, unknown>;

async function headers(prefer?: string) {
  const token = await getAccessToken();
  if (!token) throw new Error('Entre na conta para continuar.');
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...(await headers(init?.method && init.method !== 'GET' ? 'return=representation' : undefined)),
      ...(init?.headers ?? {}),
    },
  });
  const raw = await response.text();
  const body = raw ? (JSON.parse(raw) as T & { message?: string }) : (null as T);
  if (!response.ok) {
    const message = body && typeof body === 'object' && body && 'message' in body ? String(body.message) : '';
    if (response.status === 409 || /23505|duplicate/i.test(message)) {
      throw new Error('Já existe um convite pendente ou aceito para este e-mail neste evento.');
    }
    throw new Error(message || 'Não foi possível falar com a equipe do evento.');
  }
  return body;
}

function text(row: Row | null, key: string) {
  const value = row?.[key];
  return value == null ? '' : String(value);
}

function mapPermissions(value: unknown) {
  const permissions: Record<string, boolean> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return permissions;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === 'boolean') permissions[key] = item;
  }
  return permissions;
}

function mapMember(row: Row): TeamMember {
  const status = text(row, 'status');
  return {
    id: text(row, 'id'),
    eventId: text(row, 'event_id'),
    userId: text(row, 'user_id') || null,
    email: text(row, 'email'),
    name: text(row, 'invitee_name'),
    invitedBy: text(row, 'invited_by'),
    status: status === 'accepted' || status === 'revoked' ? status : 'pending',
    permissions: mapPermissions(row.permissions),
    createdAt: text(row, 'created_at') || null,
    acceptedAt: text(row, 'accepted_at') || null,
    revokedAt: text(row, 'revoked_at') || null,
  };
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify(args),
  });
  const raw = await response.text();
  const body = raw ? (JSON.parse(raw) as T & { message?: string }) : (null as T);
  if (!response.ok) {
    const message = body && typeof body === 'object' && body && 'message' in body ? String(body.message) : '';
    throw new Error(message || 'Não foi possível consultar a equipe.');
  }
  return body;
}

function firstRow(value: unknown): Row | null {
  if (Array.isArray(value)) return (value[0] as Row) ?? null;
  if (value && typeof value === 'object') return value as Row;
  return null;
}

export async function assertEventOwner(eventId: string) {
  const user = await getAuthUser();
  if (!user?.id) throw new Error('Entre na conta para continuar.');
  const rows = await rest<Row[]>(
    `events?select=created_by&id=eq.${encodeURIComponent(eventId)}&limit=1`
  );
  const ownerId = Array.isArray(rows) ? text(rows[0] ?? null, 'created_by') : '';
  if (!ownerId || ownerId !== user.id) {
    throw new Error('Apenas o proprietário do evento pode alterar estas informações.');
  }
}

export async function fetchUserProfile(userId: string) {
  try {
    const rows = await rest<Row[]>(
      `profiles?select=full_name,email&id=eq.${encodeURIComponent(userId)}&limit=1`
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;
    return { name: text(row, 'full_name'), email: text(row, 'email') };
  } catch {
    return null;
  }
}

export async function fetchEventTeam(eventId: string) {
  await assertEventOwner(eventId);
  const rows = await rest<Row[]>(
    `event_team_members?select=${MEMBER_COLUMNS}&event_id=eq.${encodeURIComponent(eventId)}&order=created_at.desc`
  );
  return (Array.isArray(rows) ? rows : []).map(mapMember);
}

export async function inviteTeamMember(eventId: string, email: string) {
  await assertEventOwner(eventId);
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Informe um e-mail válido.');
  }
  const user = await getAuthUser();
  if (user?.email && normalizeEmail(user.email) === normalized) {
    throw new Error('Você é o dono deste evento e não precisa de convite.');
  }
  let account: Row | null = null;
  try {
    account = firstRow(await rpc<unknown>('find_gate8_user_by_email', { _email: normalized }));
  } catch {
    account = null;
  }
  const accountId = text(account, 'user_id') || null;
  if (accountId && accountId === user?.id) {
    throw new Error('Você é o dono deste evento e não precisa de convite.');
  }
  const rows = await rest<Row[]>(`event_team_members`, {
    method: 'POST',
    body: JSON.stringify({
      event_id: eventId,
      user_id: accountId,
      email: normalized,
      invitee_name: text(account, 'full_name') || null,
      invited_by: user?.id,
      role: 'viewer',
      status: 'pending',
    }),
  });
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) throw new Error('Não foi possível enviar o convite.');
  return mapMember(row);
}

export async function updateTeamPermissions(
  eventId: string,
  memberId: string,
  permissions: Record<string, boolean>
) {
  await assertEventOwner(eventId);
  const rows = await rest<Row[]>(
    `event_team_members?id=eq.${encodeURIComponent(memberId)}&event_id=eq.${encodeURIComponent(eventId)}&status=eq.accepted`,
    {
      method: 'PATCH',
      body: JSON.stringify({ permissions }),
    }
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) throw new Error('Não foi possível salvar as permissões.');
  return mapMember(row);
}

export async function revokeTeamMember(eventId: string, memberId: string) {
  await assertEventOwner(eventId);
  const rows = await rest<Row[]>(
    `event_team_members?id=eq.${encodeURIComponent(memberId)}&event_id=eq.${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status: 'revoked' }),
    }
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) throw new Error('Não foi possível remover o acesso.');
  return mapMember(row);
}

export async function fetchMyMembership(eventId: string, userId: string, email: string | null) {
  const filters = [`user_id.eq.${userId}`];
  if (email) filters.push(`email.eq.${encodeURIComponent(normalizeEmail(email))}`);
  try {
    const rows = await rest<Row[]>(
      `event_team_members?select=*&event_id=eq.${encodeURIComponent(eventId)}&or=(${filters.join(',')})&order=created_at.desc&limit=5`
    );
    return (Array.isArray(rows) ? rows : []).map(mapMember);
  } catch {
    return [];
  }
}

const EVENT_EMBED =
  'events(id,name,event_date,location,capacity,banner_url,is_ended,is_hidden,hidden_event_type,ticket_delivery_active,status)';

function embeddedEvent(row: Row) {
  return (row.events as Row) ?? null;
}

export type PendingInvite = TeamMember & {
  eventName: string;
  available: boolean;
};

export async function fetchPendingInvites(userId: string, email: string | null): Promise<PendingInvite[]> {
  const filters = [`user_id.eq.${userId}`];
  if (email) filters.push(`email.eq.${encodeURIComponent(normalizeEmail(email))}`);
  try {
    const rows = await rest<Row[]>(
      `event_team_members?select=${MEMBER_COLUMNS},${EVENT_EMBED}&or=(${filters.join(',')})&status=eq.pending&order=created_at.desc`
    );
    return (Array.isArray(rows) ? rows : []).map((row) => {
      const event = embeddedEvent(row);
      const status = event ? text(event, 'status') || null : null;
      const ended = event ? Boolean(event.is_ended) : false;
      const known = Boolean(event);
      return {
        ...mapMember(row),
        eventName: text(event, 'name') || 'Evento',
        available: known ? eventIsSharedAvailable(status, ended) : true,
      };
    });
  } catch {
    return [];
  }
}

export async function acceptTeamInvite(memberId: string) {
  const user = await getAuthUser();
  if (!user?.id) throw new Error('Entre na conta para continuar.');
  const rows = await rest<Row[]>(`event_team_members?id=eq.${encodeURIComponent(memberId)}&status=eq.pending`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'accepted' }),
  });
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) throw new Error('Este convite não está mais disponível.');
  return mapMember(row);
}

export async function loadTeamPermissions(eventId: string, userId: string, stored: Record<string, boolean>) {
  const entries = await Promise.all(
    TEAM_PERMISSIONS.map(async (item) => {
      try {
        const allowed = await rpc<boolean>('team_member_can', {
          _event_id: eventId,
          _user_id: userId,
          _permission: item.key,
        });
        return [item.key, allowed === true] as const;
      } catch {
        return [item.key, permissionAllowed(stored, item.key)] as const;
      }
    })
  );
  return Object.fromEntries(entries) as Record<TeamPermission, boolean>;
}

export async function hasAcceptedMembership(userId: string) {
  try {
    const rows = await rest<Row[]>(
      `event_team_members?select=id&user_id=eq.${encodeURIComponent(userId)}&status=eq.accepted&limit=1`
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

export type SharedEvent = {
  id: string;
  name: string;
  eventDate: string | null;
  location: string | null;
  bannerUrl: string | null;
  isEnded: boolean;
  isHidden: boolean;
  status: string | null;
  available: boolean;
};

export async function fetchViewerEvents(userId: string): Promise<SharedEvent[]> {
  try {
    const rows = await rest<Row[]>(
      `event_team_members?select=event_id,accepted_at,${EVENT_EMBED}&user_id=eq.${encodeURIComponent(userId)}&status=eq.accepted&role=eq.viewer&order=accepted_at.desc`
    );
    return (Array.isArray(rows) ? rows : [])
      .map((row) => {
        const event = embeddedEvent(row);
        const status = text(event, 'status') || null;
        const isEnded = Boolean(event?.is_ended);
        return {
          id: text(event, 'id') || text(row, 'event_id'),
          name: text(event, 'name') || 'Evento',
          eventDate: text(event, 'event_date') || null,
          location: text(event, 'location') || null,
          bannerUrl: text(event, 'banner_url') || null,
          isEnded,
          isHidden: Boolean(event?.is_hidden),
          status,
          available: Boolean(event) && eventIsSharedAvailable(status, isEnded),
        };
      })
      .filter((event) => event.id);
  } catch {
    return [];
  }
}

export type SharedMenu = {
  visible: boolean;
  pendingCount: number;
  invites: PendingInvite[];
  events: SharedEvent[];
};

export async function fetchSharedMenu(userId: string, email: string | null): Promise<SharedMenu> {
  const [invites, events] = await Promise.all([
    fetchPendingInvites(userId, email),
    fetchViewerEvents(userId),
  ]);
  const pending = invites.filter((invite) => invite.available);
  const open = events.filter((event) => event.available);
  return {
    visible: pending.length > 0 || open.length > 0,
    pendingCount: pending.length,
    invites: pending,
    events: open,
  };
}
