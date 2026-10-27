export type TeamRole = 'owner' | 'viewer';
export type TeamStatus = 'pending' | 'accepted' | 'revoked';

export const TEAM_PERMISSIONS = [
  { key: 'balanco', label: 'Balanço' },
  { key: 'boletos', label: 'Boletos' },
  { key: 'cupons', label: 'Cupom de desconto' },
  { key: 'estornos', label: 'Estornos' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'historico', label: 'Histórico de validação' },
  { key: 'portaria', label: 'Portaria' },
  { key: 'retirada', label: 'Retirada' },
  { key: 'transferencias', label: 'Transferência de ingressos' },
] as const;

export type TeamPermission = (typeof TEAM_PERMISSIONS)[number]['key'];

export function permissionAllowed(permissions: Record<string, unknown> | null | undefined, key: string) {
  return permissions?.[key] !== false;
}

export function eventIsSharedAvailable(status: string | null, isEnded: boolean | null | undefined) {
  return status === 'published' && isEnded !== true;
}

export type TeamRow = {
  eventId: string;
  userId: string | null;
  email: string;
  invitedBy: string;
  role: TeamRole;
  status: TeamStatus;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function resolveEventRole(
  userId: string,
  ownerId: string | null,
  membership: { userId: string | null; status: TeamStatus; role: TeamRole } | null
): TeamRole | null {
  if (ownerId && ownerId === userId) return 'owner';
  if (
    membership &&
    membership.userId === userId &&
    membership.status === 'accepted' &&
    membership.role === 'viewer'
  ) {
    return 'viewer';
  }
  if (!ownerId && !membership) return 'owner';
  return null;
}

export function canMutate(role: TeamRole | null) {
  return role === 'owner';
}

export function canRead(role: TeamRole | null) {
  return role === 'owner' || role === 'viewer';
}

export function canManageTeam(role: TeamRole | null) {
  return role === 'owner';
}

export function inviteDuplicate(existing: { email: string; status: TeamStatus }[], email: string) {
  const next = normalizeEmail(email);
  return existing.some(
    (row) => normalizeEmail(row.email) === next && (row.status === 'pending' || row.status === 'accepted')
  );
}

export type TeamUpdateResult = { ok: true; row: TeamRow } | { ok: false; reason: string };

export function guardTeamUpdate(
  actorId: string,
  ownerId: string,
  current: TeamRow,
  next: TeamRow,
  actorEmail?: string | null
): TeamUpdateResult {
  if (next.eventId !== current.eventId || next.invitedBy !== current.invitedBy || next.email !== current.email) {
    return { ok: false, reason: 'O convite não pode trocar de evento, dono ou e-mail.' };
  }
  if (next.role !== 'viewer') {
    return { ok: false, reason: 'Um convite não pode virar proprietário.' };
  }

  if (actorId === ownerId) {
    if (next.status === 'revoked' || next.status === current.status) return { ok: true, row: next };
    if (current.status === 'pending' && next.status === 'accepted') return { ok: false, reason: 'Quem aceita o convite é o convidado.' };
    return { ok: false, reason: 'O proprietário só pode revogar o acesso.' };
  }

  const ownsInvite =
    current.userId === actorId ||
    (actorEmail != null && normalizeEmail(actorEmail) === normalizeEmail(current.email));
  if (!ownsInvite || next.userId !== actorId) {
    return { ok: false, reason: 'O convidado só pode aceitar o próprio convite.' };
  }
  if (current.status !== 'pending' || next.status !== 'accepted' || next.role !== 'viewer') {
    return { ok: false, reason: 'O convidado só pode aceitar um convite pendente, como leitura.' };
  }
  return { ok: true, row: next };
}
