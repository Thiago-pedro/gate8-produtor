import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Loader } from '@/components/Loader';
import { colors } from '@/constants/theme';
import { permissionAllowed, TEAM_PERMISSIONS } from '@/lib/team-access';
import {
  fetchEventTeam,
  fetchUserProfile,
  inviteTeamMember,
  revokeTeamMember,
  updateTeamPermissions,
  type TeamMember,
} from '@/lib/team';

function statusLabel(status: TeamMember['status']) {
  if (status === 'accepted') return 'Aceito';
  if (status === 'revoked') return 'Revogado';
  return 'Pendente';
}

function displayName(name: string) {
  return name.trim() || 'Nome não informado';
}

export function EquipeSection({
  eventId,
  ownerId,
  ownerEmail,
  nonce,
  onToast,
}: {
  eventId: string;
  ownerId: string | null;
  ownerEmail: string;
  nonce: number;
  onToast: (message: string) => void;
}) {
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [owner, setOwner] = useState<{ name: string; email: string } | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [team, profile] = await Promise.all([
        fetchEventTeam(eventId),
        ownerId ? fetchUserProfile(ownerId) : Promise.resolve(null),
      ]);
      setMembers(team);
      setOwner({
        email: profile?.email || ownerEmail,
        name: profile?.name || 'Nome não informado',
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar a equipe.');
    } finally {
      setBusy(false);
    }
  }, [eventId, ownerEmail, ownerId]);

  useEffect(() => {
    void load();
  }, [load, nonce]);

  async function invite() {
    setSending(true);
    try {
      await inviteTeamMember(eventId, email);
      setEmail('');
      onToast('Convite registrado. O acesso só vale depois que a pessoa aceitar.');
      await load();
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : 'Não foi possível convidar.');
    } finally {
      setSending(false);
    }
  }

  function openPermissions(member: TeamMember) {
    const next: Record<string, boolean> = {};
    for (const item of TEAM_PERMISSIONS) next[item.key] = permissionAllowed(member.permissions, item.key);
    setDraft(next);
    setEditing(member);
  }

  async function savePermissions() {
    if (!editing || saving) return;
    setSaving(true);
    try {
      await updateTeamPermissions(eventId, editing.id, draft);
      setEditing(null);
      onToast('Permissões salvas.');
      await load();
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : 'Não foi possível salvar as permissões.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(member: TeamMember) {
    try {
      await revokeTeamMember(eventId, member.id);
      onToast(member.status === 'pending' ? 'Convite revogado.' : 'Acesso removido.');
      await load();
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : 'Não foi possível remover.');
    }
  }

  if (busy && !members) {
    return (
      <View style={styles.boot}>
        <Loader size={148} />
      </View>
    );
  }

  return (
    <View style={styles.block}>
      <Text style={styles.title}>Equipe</Text>
      <Text style={styles.copy}>
        Convide uma conta Gate8 para consultar este evento. O que você liberar aqui vale no site e no app.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.role}>Proprietário</Text>
        <Text style={styles.email}>{owner?.email || ownerEmail || 'E-mail não informado'}</Text>
        <Text style={styles.name}>{displayName(owner?.name || '')}</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="E-mail da conta Gate8"
          placeholderTextColor="rgba(255,255,255,0.32)"
          style={styles.input}
        />
        <Pressable
          onPress={() => void invite()}
          disabled={sending}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Ionicons name="person-add-outline" size={16} color={colors.loginText} />
          <Text style={styles.primaryText}>{sending ? 'Convidando...' : 'Convidar'}</Text>
        </Pressable>
      </View>

      {(members ?? []).length === 0 ? <Text style={styles.empty}>Ninguém foi convidado ainda.</Text> : null}
      {(members ?? []).map((member) => (
        <View key={member.id} style={styles.card}>
          <Text style={styles.email}>{member.email}</Text>
          <Text style={styles.name}>{displayName(member.name)}</Text>
          <Text style={styles.meta}>Leitura · {statusLabel(member.status)}</Text>
          {member.status === 'accepted' || member.status === 'pending' ? (
            <View style={styles.actions}>
              {member.status === 'accepted' ? (
                <Pressable onPress={() => openPermissions(member)} hitSlop={8}>
                  <Text style={styles.permissions}>Permissões</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => void remove(member)} hitSlop={8}>
                <Text style={styles.remove}>{member.status === 'pending' ? 'Revogar' : 'Remover acesso'}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ))}

      <Modal visible={Boolean(editing)} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditing(null)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Permissões</Text>
            <Text style={styles.meta}>{editing?.email}</Text>
            {TEAM_PERMISSIONS.map((item) => (
              <View key={item.key} style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{item.label}</Text>
                <Switch
                  value={draft[item.key] !== false}
                  onValueChange={(value) => setDraft((current) => ({ ...current, [item.key]: value }))}
                  trackColor={{ true: colors.blue }}
                />
              </View>
            ))}
            <Pressable
              onPress={() => void savePermissions()}
              disabled={saving}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>{saving ? 'Salvando...' : 'Salvar'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  boot: { minHeight: 180, alignItems: 'center', justifyContent: 'center' },
  block: { marginTop: 18, gap: 10 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  copy: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 13 },
  empty: { color: colors.muted, fontSize: 13 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 14,
    gap: 4,
  },
  role: { color: colors.blue, fontSize: 12, fontWeight: '700' },
  email: { color: colors.text, fontSize: 15, fontWeight: '700' },
  name: { color: colors.muted, fontSize: 13 },
  meta: { color: colors.muted, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 8 },
  form: { gap: 8 },
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    color: colors.text,
    paddingHorizontal: 12,
  },
  primary: {
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryText: { color: colors.loginText, fontWeight: '700' },
  pressed: { opacity: 0.75 },
  permissions: { color: colors.blue, fontWeight: '700', fontSize: 13 },
  remove: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(5, 13, 31, 0.78)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    borderRadius: 18,
    backgroundColor: '#071329',
    borderWidth: 1,
    borderColor: 'rgba(0,123,255,0.45)',
    padding: 16,
    gap: 10,
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  toggleLabel: { color: colors.text, fontSize: 14, flex: 1 },
});
