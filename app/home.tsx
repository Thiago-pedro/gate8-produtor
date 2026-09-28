import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { useProducer } from '@/lib/producer-context';

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
  const { user, loading, signOut } = useAuth();
  const { status, loading: producerLoading } = useProducer();
  const [events, setEvents] = useState<ProducerEvent[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<EventFilter>('active');
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
    if (status === 'guest') router.replace('/convite');
  }, [loading, producerLoading, router, status, user]);

  const load = useCallback(async (soft = false) => {
    if (!user) return;
    if (!soft) setBusy(true);
    setError(null);
    try {
      setEvents(await fetchProducerEvents(user.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os eventos.');
    } finally {
      setBusy(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (user && status === 'producer') {
        void load(sawList.current);
        sawList.current = true;
      }
    }, [load, status, user])
  );

  const visible = useMemo(() => {
    if (filter === 'active') return events.filter(isOpenEvent);
    if (filter === 'ended') return events.filter((event) => !isOpenEvent(event));
    return events;
  }, [events, filter]);

  const emptyMessage =
    events.length === 0
      ? 'Muito calmo,\nTá faltando festa por aqui! 🎉\nCrie seu evento.'
      : filter === 'active'
        ? 'Nenhuma festa ativa por aqui.'
        : filter === 'ended'
          ? 'Nenhuma festa encerrada por aqui.'
          : 'Muito calmo,\nTá faltando festa por aqui! 🎉\nCrie seu evento.';

  if (loading || producerLoading || !user || status !== 'producer') {
    return (
      <View style={styles.boot}>
        <Loader screen />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Wordmark height={28} />
        <Pressable
          onPress={() => setLeaveOpen(true)}
          hitSlop={12}
          style={styles.exitBtn}
          accessibilityRole="button"
          accessibilityLabel="Sair"
        >
          <Ionicons name="exit-outline" size={24} color="rgba(255,255,255,0.88)" />
        </Pressable>
      </View>

      <Text style={styles.hello}>Olá{user.name ? `, ${user.name.split(' ')[0]}` : ''}</Text>
      <View style={styles.leadRow}>
        <Text style={styles.lead}>Meus eventos</Text>
        <Pressable
          onPress={() => router.push('/evento/novo')}
          style={({ pressed }) => [styles.createBtn, pressed && styles.cardPressed]}
        >
          <Ionicons name="add" size={16} color={colors.loginText} />
          <Text style={styles.createText}>Criar evento</Text>
        </Pressable>
      </View>

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

      <ScrollView
        contentContainerStyle={styles.list}
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
        {busy ? <Loader screen /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!busy && !error && visible.length === 0 ? (
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
            <EventArt uri={event.banner_url} ended={ended} height={140} />
            <View style={styles.cardBody}>
              <View style={styles.nameRow}>
                <Text style={styles.eventName} numberOfLines={2}>
                  {event.name}
                </Text>
                {event.is_hidden ? (
                  <View style={styles.hiddenBadge}>
                    <Text style={styles.hiddenBadgeText}>Oculto</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={14} color={colors.blue} />
                <Text style={styles.eventMeta}>{formatDate(event.event_date)}</Text>
              </View>
              {event.location ? (
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={14} color={colors.blue} />
                  <Text style={styles.eventMeta} numberOfLines={1}>
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
    backgroundColor: colors.bg,
  },
  boot: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    height: 44,
    marginHorizontal: 16,
    marginTop: 19,
    paddingBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  exitBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingLeft: 8,
  },
  hello: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginTop: 18,
  },
  lead: {
    color: colors.muted,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    flex: 1,
  },
  leadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 10,
    gap: 10,
  },
  filters: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterChip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipOn: {
    backgroundColor: colors.blue,
  },
  filterText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  filterTextOn: {
    color: colors.loginText,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.blue,
    borderRadius: 999,
    height: 36,
    paddingHorizontal: 12,
  },
  createText: {
    color: colors.loginText,
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 0,
    gap: 10,
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.88,
  },
  cardBody: {
    padding: 14,
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  eventName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  hiddenBadge: {
    backgroundColor: 'rgba(0,123,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(0,123,255,0.45)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  hiddenBadgeText: {
    color: colors.blue,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventMeta: {
    color: colors.muted,
    fontSize: 13,
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
