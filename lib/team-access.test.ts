import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canManageTeam,
  canMutate,
  canRead,
  guardTeamUpdate,
  inviteDuplicate,
  permissionAllowed,
  resolveEventRole,
  type TeamRow,
} from './team-access.ts';

const owner = 'owner-1';
const guest = 'guest-1';
const other = 'other-1';

const pending: TeamRow = {
  eventId: 'event-1',
  userId: guest,
  email: 'pessoa@gate8.club',
  invitedBy: owner,
  role: 'viewer',
  status: 'pending',
};

test('proprietário mantém acesso total', () => {
  const role = resolveEventRole(owner, owner, null);
  assert.equal(role, 'owner');
  assert.equal(canMutate(role), true);
  assert.equal(canRead(role), true);
  assert.equal(canManageTeam(role), true);
});

test('convidado aceito só consulta o evento autorizado', () => {
  const role = resolveEventRole(guest, owner, { userId: guest, status: 'accepted', role: 'viewer' });
  assert.equal(role, 'viewer');
  assert.equal(canRead(role), true);
  assert.equal(canMutate(role), false);
  assert.equal(canManageTeam(role), false);
});

test('convite pendente ou revogado não abre o evento', () => {
  assert.equal(resolveEventRole(guest, owner, { userId: guest, status: 'pending', role: 'viewer' }), null);
  assert.equal(resolveEventRole(guest, owner, { userId: guest, status: 'revoked', role: 'viewer' }), null);
});

test('usuário sem vínculo não entra no evento de outro', () => {
  assert.equal(resolveEventRole(other, owner, null), null);
  assert.equal(canRead(null), false);
  assert.equal(canMutate(null), false);
});

test('convite duplicado é bloqueado enquanto está pendente ou aceito', () => {
  const rows = [
    { email: 'Pessoa@gate8.club', status: 'pending' as const },
    { email: 'outro@gate8.club', status: 'revoked' as const },
  ];
  assert.equal(inviteDuplicate(rows, 'pessoa@gate8.club'), true);
  assert.equal(inviteDuplicate(rows, 'outro@gate8.club'), false);
});

test('convidado aceita o próprio convite e não vira proprietário', () => {
  const accepted = guardTeamUpdate(guest, owner, pending, { ...pending, status: 'accepted', userId: guest });
  assert.equal(accepted.ok, true);
  const promote = guardTeamUpdate(guest, owner, pending, { ...pending, role: 'owner', status: 'accepted', userId: guest });
  assert.equal(promote.ok, false);
});

test('conta nova aceita pelo e-mail do convite e outro e-mail não entra', () => {
  const open = { ...pending, userId: null };
  const accepted = guardTeamUpdate(guest, owner, open, { ...open, status: 'accepted', userId: guest }, 'pessoa@gate8.club');
  assert.equal(accepted.ok, true);
  const stranger = guardTeamUpdate(other, owner, open, { ...open, status: 'accepted', userId: other }, 'outro@gate8.club');
  assert.equal(stranger.ok, false);
});

test('convidado não aceita convite de outra pessoa nem muda o evento', () => {
  const stolen = guardTeamUpdate(other, owner, pending, { ...pending, status: 'accepted', userId: other });
  assert.equal(stolen.ok, false);
  const moved = guardTeamUpdate(guest, owner, pending, { ...pending, eventId: 'event-2', status: 'accepted' });
  assert.equal(moved.ok, false);
});

test('proprietário revoga e o acesso deixa de valer', () => {
  const revoked = guardTeamUpdate(owner, owner, { ...pending, status: 'accepted' }, { ...pending, status: 'revoked' });
  assert.equal(revoked.ok, true);
  assert.equal(
    resolveEventRole(guest, owner, { userId: guest, status: 'revoked', role: 'viewer' }),
    null
  );
});

test('permissão ausente libera e false esconde o menu', () => {
  assert.equal(permissionAllowed(null, 'financeiro'), true);
  assert.equal(permissionAllowed({}, 'financeiro'), true);
  assert.equal(permissionAllowed({ financeiro: true }, 'financeiro'), true);
  assert.equal(permissionAllowed({ financeiro: false }, 'financeiro'), false);
  assert.equal(permissionAllowed({ financeiro: false }, 'balanco'), true);
});

test('proprietário não aceita no lugar do convidado e convidado não revoga', () => {
  const ownerAccepts = guardTeamUpdate(owner, owner, pending, { ...pending, status: 'accepted' });
  assert.equal(ownerAccepts.ok, false);
  const guestRevokes = guardTeamUpdate(guest, owner, { ...pending, status: 'accepted' }, { ...pending, status: 'revoked', userId: guest });
  assert.equal(guestRevokes.ok, false);
});
