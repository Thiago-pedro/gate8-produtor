import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NeonCard } from '@/components/NeonCard';
import { Spinner } from '@/components/Spinner';
import { Wordmark } from '@/components/Wordmark';
import { colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { fetchProducerEvents, type ProducerEvent } from '@/lib/events';

function formatDate(value: string | null) {
  if (!value) return 'Data a definir';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data a definir';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
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
    if (!loading && !user) router.replace('/login');
  }, [loading, router, user]);

  const load = useCallback(async (soft = false) => {
    if (!soft) setBusy(true);
    setError(null);
    try {
      setEvents(await fetchProducerEvents());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os eventos.');
    } finally {
      setBusy(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [load, user]);

  if (loading || !user) {
    return (
      <View style={styles.boot}>
        <Spinner size={28} color={colors.blue} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
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
      <Text style={styles.lead}>Meus eventos</Text>

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
        {busy ? (
          <View style={styles.center}>
            <Spinner size={28} color={colors.blue} />
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!busy && !error && events.length === 0 ? (
          <Text style={styles.empty}>Nenhum evento por aqui ainda.</Text>
        ) : null}
        {events.map((event) => (
          <View key={event.id} style={styles.card}>
            <Text style={styles.eventName}>{event.name}</Text>
            <Text style={styles.eventMeta}>{formatDate(event.event_date)}</Text>
            <Text style={styles.eventStatus}>{event.status === 'published' ? 'Publicado' : event.status || 'Rascunho'}</Text>
          </View>
        ))}
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
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 12,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  center: {
    paddingVertical: 32,
    alignItems: 'center',
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
    padding: 14,
    gap: 4,
  },
  eventName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  eventMeta: {
    color: colors.muted,
    fontSize: 13,
  },
  eventStatus: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
