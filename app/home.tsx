import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventArt } from '@/components/EventArt';
import { NeonCard } from '@/components/NeonCard';
import { Loader } from '@/components/Loader';
import { SiteFooter } from '@/components/SiteFooter';
import { Wordmark } from '@/components/Wordmark';
import { colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { fetchProducerEvents, isOpenEvent, type ProducerEvent } from '@/lib/events';
import { formatEventDate } from '@/lib/format';
import { fetchProducerFirstName } from '@/lib/producer';
import { useProducer } from '@/lib/producer-context';
import { fetchSharedMenu, type SharedMenu } from '@/lib/team';

function formatDate(value: string | null) {
  return formatEventDate(value);
}

type EventFilter = 'all' | 'active' | 'ended';

const FILTERS: { key: EventFilter; label: string }[] = [
  { key: 'all', label: 'Todas as festas' },
  { key: 'active', label: 'Ativas' },
  { key: 'ended', label: 'Encerradas' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user, loading, signOut } = useAuth();
  const { status, loading: producerLoading } = useProducer();
  const [events, setEvents] = useState<ProducerEvent[]>([]);
  const [shared, setShared] = useState<SharedMenu | null>(null);
  const [teamGate, setTeamGate] = useState<'unknown' | 'in' | 'out'>('unknown');
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<EventFilter>('active');
  const [producerName, setProducerName] = useState('');
  const sawList = useRef(false);

  async function leaveAccount() {
    setLeaveOpen(false);
    await signOut();
    router.replace('/login');
  }

  useEffect(() => {
    if (loading || producerLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (status === 'producer') {
      setTeamGate('in');
      return;
    }
    if (status !== 'guest') return;
    let alive = true;
    void fetchSharedMenu(user.id, user.email).then((menu) => {
      if (!alive) return;
      router.replace(menu.visible ? '/compartilhados' : '/convite');
    });
    return () => {
      alive = false;
    };
  }, [loading, producerLoading, router, status, user]);

  useEffect(() => {
    if (!user?.id || status !== 'producer') return;
    let alive = true;
    void fetchProducerFirstName(user.id).then((name) => {
      if (alive) setProducerName(name);
    });
    return () => {
      alive = false;
    };
  }, [status, user?.id]);

  const load = useCallback(async (soft = false) => {
    if (!user) return;
    if (!soft) setBusy(true);
    setError(null);
    try {
      const owned = status === 'producer' ? await fetchProducerEvents(user.id) : [];
      setEvents(owned.map((event) => ({ ...event, access: 'owner' as const })));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os eventos.');
    } finally {
      setBusy(false);
      setRefreshing(false);
    }
  }, [status, user]);

  useFocusEffect(
    useCallback(() => {
      if (user && teamGate === 'in') {
        void load(sawList.current);
        sawList.current = true;
      }
    }, [load, teamGate, user])
  );

  useEffect(() => {
    if (!user || teamGate !== 'in') return;
    let alive = true;
    const tick = () => {
      void fetchSharedMenu(user.id, user.email).then((menu) => {
        if (alive) setShared(menu);
      });
    };
    tick();
    const timer = setInterval(tick, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [teamGate, user]);

  const visible = useMemo(() => {
    if (filter === 'active') return events.filter(isOpenEvent);
    if (filter === 'ended') return events.filter((event) => !isOpenEvent(event));
    return events;
  }, [events, filter]);

  const emptyMessage =
    events.length === 0
      ? status === 'producer'
        ? 'Muito calmo,\nTá faltando festa por aqui! 🎉\nCrie seu evento.'
        : 'Nenhum evento foi compartilhado com você.'
      : filter === 'active'
        ? 'Nenhuma festa ativa por aqui.'
        : filter === 'ended'
          ? 'Nenhuma festa encerrada por aqui.'
          : 'Muito calmo,\nTá faltando festa por aqui! 🎉\nCrie seu evento.';

  const side = width >= 700 ? 32 : width >= 420 ? 24 : 20;
  const logoWidth = Math.min(200, Math.max(168, Math.round(width * 0.46)));
  const logoHeight = logoWidth / 5.4;
  const accountHeight = Math.min(112, Math.max(84, Math.round(width * 0.2)));
  const avatar = Math.min(72, Math.round(accountHeight * 0.62));
  const nameSize = Math.min(28, Math.max(18, Math.round(width * 0.048)));
  const accountSubSize = Math.min(16, Math.max(13, Math.round(width * 0.034)));
  const createHeight = Math.min(64, Math.max(52, Math.round(width * 0.133)));
  const createTextSize = Math.min(20, Math.max(16, Math.round(width * 0.044)));
  const bannerHeight = Math.round((width - side * 2) / 2.7);
  const eventTitleSize = Math.min(22, Math.max(17, Math.round(width * 0.046)));
  const eventMetaSize = Math.min(15, Math.max(13, Math.round(width * 0.033)));
  const helloName = producerName || user?.name?.split(' ')[0] || '';

  if (loading || producerLoading || !user || teamGate !== 'in') {
    return (
      <View style={styles.boot}>
        <Loader screen />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.top}>
        <Wordmark height={logoHeight} />
        <Pressable
          onPress={() => setLeaveOpen(true)}
          style={styles.exitBtn}
          accessibilityRole="button"
          accessibilityLabel="Sair"
        >
          <Ionicons name="exit-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingHorizontal: side }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(true);
            }}
            tintColor={colors.blue}
          />
        }
      >
        {status === 'producer' ? (
          <Pressable
            onPress={() => router.push('/conta')}
            accessibilityRole="button"
            accessibilityLabel="Minha conta"
            style={({ pressed }) => [
              styles.accountCard,
              { minHeight: accountHeight, borderRadius: 22 },
              pressed && styles.cardPressed,
            ]}
          >
            <View style={[styles.avatar, { width: avatar, height: avatar, borderRadius: avatar / 2 }]}>
              <Ionicons name="person" size={Math.round(avatar * 0.46)} color={colors.blue} />
            </View>
            <View style={styles.accountCopy}>
              <Text style={[styles.accountName, { fontSize: nameSize }]} numberOfLines={1}>
                Olá{helloName ? `, ${helloName}` : ''}
              </Text>
              <Text style={[styles.accountSub, { fontSize: accountSubSize }]}>Minha conta</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </Pressable>
        ) : null}

        {status === 'producer' ? (
          <Pressable
            onPress={() => router.push('/evento/novo')}
            style={({ pressed }) => [
              styles.createBtn,
              { height: createHeight, borderRadius: 22, marginTop: 16 },
              pressed && styles.cardPressed,
            ]}
          >
            <Ionicons name="add" size={22} color={colors.loginText} />
            <Text style={[styles.createText, { fontSize: createTextSize }]}>Criar evento</Text>
          </Pressable>
        ) : null}

        {shared?.visible ? (
          <Pressable
            onPress={() => router.push('/compartilhados')}
            style={({ pressed }) => [styles.sharedBtn, pressed && styles.cardPressed]}
          >
            <Ionicons name="people-outline" size={18} color={colors.blue} />
            <Text style={styles.sharedText}>Evento Compartilhado</Text>
            {shared.pendingCount > 0 ? (
              <View style={styles.sharedBadge}>
                <Text style={styles.sharedBadgeText}>{shared.pendingCount}</Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}

        {status === 'producer' ? <Text style={styles.lead}>MEUS EVENTOS</Text> : null}

        {status === 'producer' ? (
          <View style={styles.filters}>
            {FILTERS.map((item) => {
              const on = filter === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setFilter(item.key)}
                  style={[styles.filterChip, on && styles.filterChipOn]}
                >
                  <Text style={[styles.filterText, on && styles.filterTextOn]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {busy ? <Loader screen /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!busy && !error && status === 'producer' && visible.length === 0 ? (
          <Text style={styles.empty}>{emptyMessage}</Text>
        ) : null}
        {visible.map((event) => {
          const ended = !isOpenEvent(event);
          return (
            <Pressable
              key={event.id}
              onPress={() => router.push({ pathname: '/evento/[id]', params: { id: event.id } })}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <EventArt uri={event.banner_url} ended={ended} height={bannerHeight} />
              <View style={styles.cardBody}>
                <View style={styles.nameRow}>
                  <Text style={[styles.eventName, { fontSize: eventTitleSize }]} numberOfLines={2}>
                    {event.name}
                  </Text>
                  {event.is_hidden ? (
                    <View style={styles.hiddenBadge}>
                      <Text style={styles.hiddenBadgeText}>Oculto</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={16} color={colors.blue} />
                  <Text style={[styles.eventMeta, { fontSize: eventMetaSize }]} numberOfLines={1}>
                    {formatDate(event.event_date)}
                  </Text>
                </View>
                {event.location ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={16} color={colors.blue} />
                    <Text style={[styles.eventMeta, { fontSize: eventMetaSize }]} numberOfLines={1}>
                      {event.location}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
        <SiteFooter />
      </ScrollView>

      <Modal
        visible={leaveOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setLeaveOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setLeaveOpen(false)} />
          <View style={styles.modalCard}>
            <NeonCard>
              <Ionicons name="exit-outline" size={28} color={colors.blue} style={styles.modalIcon} />
              <Text style={styles.modalTitle}>Sair da conta</Text>
              <Text style={styles.modalText}>Deseja sair do painel do produtor?</Text>
              <View style={styles.modalActions}>
                <Pressable onPress={() => setLeaveOpen(false)} style={styles.modalCancel}>
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </Pressable>
                <Pressable onPress={() => void leaveAccount()} style={styles.modalLeaveWrap}>
                  <LinearGradient
                    colors={['#007BFF', '#0056b3']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalLeave}
                  >
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
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  boot: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  top: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 28,
    minHeight: 48,
  },
  exitBtn: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(8, 24, 52, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(70, 120, 180, 0.45)',
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.blue,
    backgroundColor: 'rgba(0, 123, 255, 0.08)',
  },
  accountCopy: {
    flex: 1,
    gap: 2,
  },
  accountName: {
    color: colors.text,
    fontWeight: '700',
  },
  accountSub: {
    color: 'rgba(255,255,255,0.62)',
    fontWeight: '400',
  },
  lead: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 2.4,
    marginTop: 28,
    marginBottom: 14,
  },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(6, 16, 36, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(140, 168, 200, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipOn: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  filterText: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 13,
    fontWeight: '600',
  },
  filterTextOn: {
    color: colors.loginText,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#087BFF',
  },
  createText: {
    color: colors.loginText,
    fontWeight: '700',
  },
  sharedBtn: {
    marginTop: 16,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,123,255,0.45)',
    backgroundColor: 'rgba(0,123,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  sharedText: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  sharedBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharedBadgeText: { color: colors.loginText, fontSize: 12, fontWeight: '700' },
  inviteCard: {
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
  inviteTitle: { color: colors.blue, fontSize: 12, fontWeight: '700' },
  inviteText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  acceptBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: { color: colors.loginText, fontSize: 13, fontWeight: '700' },
  readBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.blue,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  readBadgeText: { color: colors.blue, fontSize: 10, fontWeight: '700' },
  list: {
    flexGrow: 1,
    paddingBottom: 0,
    gap: 0,
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
  },
  empty: {
    color: colors.muted,
    textAlign: 'center',
    marginTop: 24,
    fontSize: 15,
    lineHeight: 24,
  },
  card: {
    backgroundColor: 'rgba(8, 24, 52, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(140, 168, 200, 0.28)',
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 14,
  },
  cardPressed: {
    opacity: 0.88,
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventName: {
    color: colors.text,
    fontWeight: '700',
    flex: 1,
  },
  hiddenBadge: {
    backgroundColor: 'rgba(6, 22, 48, 0.95)',
    borderWidth: 1,
    borderColor: colors.blue,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  hiddenBadgeText: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventMeta: {
    color: 'rgba(255,255,255,0.62)',
    flex: 1,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(5, 13, 31, 0.78)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
  },
  modalIcon: {
    alignSelf: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
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
  modalCancelText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
  modalLeaveWrap: {
    flex: 1,
  },
  modalLeave: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLeaveText: {
    color: colors.loginText,
    fontWeight: '700',
    fontSize: 15,
  },
});
