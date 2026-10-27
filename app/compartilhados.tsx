import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventArt } from '@/components/EventArt';
import { Loader } from '@/components/Loader';
import { NeonCard } from '@/components/NeonCard';
import { Wordmark } from '@/components/Wordmark';
import { colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { formatEventDate } from '@/lib/format';
import { useProducer } from '@/lib/producer-context';
import { acceptTeamInvite, fetchSharedMenu, type SharedMenu } from '@/lib/team';

const EMPTY: SharedMenu = { visible: false, pendingCount: 0, invites: [], events: [] };

export default function SharedEventsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { status } = useProducer();
  const [menu, setMenu] = useState<SharedMenu>(EMPTY);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const next = await fetchSharedMenu(user.id, user.email);
      setMenu(next);
      if (!next.visible) {
        if (status === 'producer') router.replace('/home');
        else if (status === 'guest') router.replace('/convite');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os eventos compartilhados.');
    } finally {
      setBusy(false);
      setRefreshing(false);
    }
  }, [router, status, user]);

  async function leaveAccount() {
    setLeaveOpen(false);
    await signOut();
    router.replace('/login');
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load]);

  async function accept(memberId: string) {
    setError(null);
    try {
      await acceptTeamInvite(memberId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível aceitar o convite.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        {status === 'producer' ? (
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.side}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.side} />
        )}
        <Wordmark height={22} />
        {status === 'producer' ? (
          <View style={styles.side} />
        ) : (
          <Pressable
            onPress={() => setLeaveOpen(true)}
            hitSlop={12}
            style={styles.side}
            accessibilityRole="button"
            accessibilityLabel="Sair"
          >
            <Ionicons name="exit-outline" size={22} color={colors.text} />
          </Pressable>
        )}
      </View>
      <Text style={styles.title}>Evento Compartilhado</Text>
      <Text style={styles.copy}>Consulta apenas dos eventos que o dono liberou para você.</Text>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.blue}
          />
        }
      >
        {busy ? <Loader screen /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {menu.invites.map((invite) => (
          <View key={invite.id} style={styles.invite}>
            <View style={styles.inviteCopy}>
              <Text style={styles.inviteLabel}>Convite pendente</Text>
              <Text style={styles.eventName}>{invite.eventName}</Text>
            </View>
            <Pressable onPress={() => void accept(invite.id)} style={styles.accept}>
              <Text style={styles.acceptText}>Aceitar</Text>
            </Pressable>
          </View>
        ))}
        {!busy && menu.events.length === 0 && menu.invites.length === 0 ? (
          <Text style={styles.empty}>Nenhum evento compartilhado disponível.</Text>
        ) : null}
        {menu.events.map((event) => (
          <Pressable
            key={event.id}
            onPress={() => router.push({ pathname: '/evento/[id]', params: { id: event.id } })}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <EventArt uri={event.bannerUrl} ended={event.isEnded} height={140} />
            <View style={styles.cardBody}>
              <Text style={styles.eventName}>{event.name}</Text>
              <Text style={styles.meta}>{formatEventDate(event.eventDate)}</Text>
              {event.location ? <Text style={styles.meta}>{event.location}</Text> : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <Modal visible={leaveOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setLeaveOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setLeaveOpen(false)} />
          <View style={styles.modalCard}>
            <NeonCard>
              <Ionicons name="exit-outline" size={28} color={colors.blue} style={styles.modalIcon} />
              <Text style={styles.modalTitle}>Sair da conta</Text>
              <Text style={styles.modalText}>Deseja sair da sua conta?</Text>
              <View style={styles.modalActions}>
                <Pressable onPress={() => setLeaveOpen(false)} style={styles.modalCancel}>
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </Pressable>
                <Pressable onPress={() => void leaveAccount()} style={styles.modalLeaveWrap}>
                  <LinearGradient colors={['#007BFF', '#0056b3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modalLeave}>
                    <Text style={styles.modalLeaveText}>Sair</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </NeonCard>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  header: {
    height: 44,
    marginHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  side: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 22, fontWeight: '700', marginHorizontal: 16, marginTop: 8 },
  copy: { color: colors.muted, fontSize: 13, lineHeight: 18, marginHorizontal: 16, marginTop: 6, marginBottom: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  error: { color: colors.danger, textAlign: 'center' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 24 },
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,123,255,0.45)',
    backgroundColor: 'rgba(0,123,255,0.08)',
    padding: 14,
  },
  inviteCopy: { flex: 1, gap: 2 },
  inviteLabel: { color: colors.blue, fontSize: 12, fontWeight: '700' },
  accept: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: { color: colors.loginText, fontSize: 13, fontWeight: '700' },
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(8, 24, 52, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(140, 168, 200, 0.28)',
  },
  modalRoot: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, backgroundColor: 'rgba(0,0,0,0.55)' },
  modalCard: { width: '100%' },
  modalIcon: { alignSelf: 'center', marginBottom: 10 },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  modalText: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8, marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancel: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  modalCancelText: { color: colors.text, fontWeight: '600', fontSize: 15 },
  modalLeaveWrap: { flex: 1 },
  modalLeave: { height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalLeaveText: { color: colors.loginText, fontWeight: '700', fontSize: 15 },
  pressed: { opacity: 0.8 },
  cardBody: { padding: 12, gap: 4 },
  eventName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 13 },
});
