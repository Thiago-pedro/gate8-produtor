import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NeonCard } from '@/components/NeonCard';
import { Loader } from '@/components/Loader';
import { SiteFooter } from '@/components/SiteFooter';
import { Wordmark } from '@/components/Wordmark';
import { colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { fetchProducerEvents, type ProducerEvent } from '@/lib/events';
import { formatEventDate } from '@/lib/format';
import { useProducer } from '@/lib/producer-context';

function formatDate(value: string | null) {
  return formatEventDate(value);
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const { status, loading: producerLoading } = useProducer();
  const [events, setEvents] = useState<ProducerEvent[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (user && status === 'producer') void load();
  }, [load, status, user]);

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
        {!busy && !error && events.length === 0 ? (
          <Text style={styles.empty}>Nenhum evento por aqui ainda. Crie o primeiro.</Text>
        ) : null}
        {events.map((event) => (
          <Pressable
            key={event.id}
            onPress={() => router.push({ pathname: '/evento/[id]', params: { id: event.id } })}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            {event.banner_url ? (
              <Image source={{ uri: event.banner_url }} style={styles.banner} />
            ) : (
              <View style={[styles.banner, styles.bannerEmpty]} />
            )}
            <View style={styles.cardBody}>
              <Text style={styles.eventName} numberOfLines={2}>
                {event.name}
              </Text>
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
              <Text style={styles.sold}>
                {event.sold} {event.sold === 1 ? 'ingresso vendido' : 'ingressos vendidos'}
                {event.quantity ? ` · ${event.quantity} no total` : ''}
              </Text>
            </View>
          </Pressable>
        ))}
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
    height: 36,
    marginHorizontal: 16,
    marginTop: 8,
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
    marginBottom: 12,
    gap: 10,
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
  banner: {
    width: '100%',
    height: 140,
    backgroundColor: colors.bgElevated,
  },
  bannerEmpty: {
    backgroundColor: colors.bgElevated,
  },
  cardBody: {
    padding: 14,
    gap: 6,
  },
  eventName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
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
  sold: {
    color: colors.blue,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
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
