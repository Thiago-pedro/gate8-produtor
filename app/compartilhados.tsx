import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventArt } from '@/components/EventArt';
import { Loader } from '@/components/Loader';
import { Wordmark } from '@/components/Wordmark';
import { colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { formatEventDate } from '@/lib/format';
import { acceptTeamInvite, fetchSharedMenu, type SharedMenu } from '@/lib/team';

const EMPTY: SharedMenu = { visible: false, pendingCount: 0, invites: [], events: [] };

export default function SharedEventsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [menu, setMenu] = useState<SharedMenu>(EMPTY);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const next = await fetchSharedMenu(user.id, user.email);
      setMenu(next);
      if (!next.visible) router.replace('/home');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os eventos compartilhados.');
    } finally {
      setBusy(false);
      setRefreshing(false);
    }
  }, [router, user]);

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
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.side}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Wordmark height={22} />
        <View style={styles.side} />
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
  card: { borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)' },
  pressed: { opacity: 0.8 },
  cardBody: { padding: 12, gap: 4 },
  eventName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 13 },
});
