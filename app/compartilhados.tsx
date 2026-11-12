import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventArt } from '@/components/EventArt';
import { HomeBirth } from '@/components/HomeBirth';
import { Loader } from '@/components/Loader';
import { NeonCard } from '@/components/NeonCard';
import { Wordmark } from '@/components/Wordmark';
import { colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { formatEventPeriod } from '@/lib/event-period';
import { useProducer } from '@/lib/producer-context';
import { acceptTeamInvite, fetchSharedMenu, type SharedEvent, type SharedMenu } from '@/lib/team';

const EMPTY: SharedMenu = { visible: false, pendingCount: 0, invites: [], events: [] };
const ELECTRIC = '#0000FE';
const SHARED_ICON = require('../assets/images/shared-events-icon.png');

function SharedEventCard({
  event,
  onPress,
}: {
  event: SharedEvent;
  onPress: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardArt}>
        <EventArt uri={event.bannerUrl} ended={event.isEnded} height={168} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.eventName} numberOfLines={2}>
          {event.name}
        </Text>

        <View style={styles.datePill}>
          <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.78)" />
          <Text style={styles.datePillText}>
            {formatEventPeriod(event.eventDate, event.eventEndDate)}
          </Text>
        </View>

        {event.location ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={15} color="#FFFFFF" style={styles.locationIcon} />
            <Text style={styles.locationText}>{event.location}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.accessBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Acessar evento ${event.name}`}
        >
          <View style={styles.accessBtnSide}>
            <Ionicons name="eye-outline" size={18} color="#FFFFFF" />
          </View>
          <Text style={styles.accessBtnText}>Acessar Evento</Text>
          <View style={styles.accessBtnSide}>
            <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

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

  const releasedLabel =
    menu.events.length === 1 ? '1 evento liberado' : `${menu.events.length} eventos liberados`;

  return (
    <View style={styles.screen}>
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

        <View style={styles.hero}>
          <Image source={SHARED_ICON} style={styles.heroIcon} resizeMode="contain" />
          <View style={styles.heroCopy}>
            <Text style={styles.title}>Evento Compartilhado</Text>
            <Text style={styles.copy}>
              Consulte apenas os eventos que o produtor responsável pelo evento liberou para você.
            </Text>
          </View>
        </View>

        <View style={styles.accessBar}>
          <View style={styles.accessLeft}>
            <Ionicons name="lock-closed" size={13} color="#FFFFFF" />
            <Text style={styles.accessLabel}>Acesso restrito</Text>
          </View>
          <Text style={styles.accessCount}>{releasedLabel}</Text>
        </View>

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
              colors={[colors.blue]}
              progressBackgroundColor={colors.bgElevated}
            />
          }
        >
          {busy ? <Loader screen /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {menu.invites.map((invite) => (
            <View key={invite.id} style={styles.invite}>
              <View style={styles.inviteCopy}>
                <Text style={styles.inviteLabel}>Convite pendente</Text>
                <Text style={styles.inviteName}>{invite.eventName}</Text>
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
            <SharedEventCard
              key={event.id}
              event={event}
              onPress={() => router.push({ pathname: '/evento/[id]', params: { id: event.id } })}
            />
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
                <Ionicons name="exit-outline" size={28} color={ELECTRIC} style={styles.modalIcon} />
                <Text style={styles.modalTitle}>Sair da conta</Text>
                <Text style={styles.modalText}>Deseja sair da sua conta?</Text>
                <View style={styles.modalActions}>
                  <Pressable onPress={() => setLeaveOpen(false)} style={styles.modalCancel}>
                    <Text style={styles.modalCancelText}>Cancelar</Text>
                  </Pressable>
                  <Pressable onPress={() => void leaveAccount()} style={styles.modalLeaveWrap}>
                    <LinearGradient
                      colors={[ELECTRIC, '#0000A8']}
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
      <HomeBirth />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1, backgroundColor: 'transparent' },
  header: {
    height: 44,
    marginHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  side: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 16,
    marginTop: 10,
  },
  heroIcon: {
    width: 64,
    height: 64,
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  copy: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 13,
    lineHeight: 18,
  },
  accessBar: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    minHeight: 40,
    borderRadius: 999,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(4, 12, 36, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 254, 0.22)',
  },
  accessLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accessLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  accessCount: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 16,
  },
  error: { color: colors.danger, textAlign: 'center' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 24 },
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,254,0.45)',
    backgroundColor: 'rgba(0,0,254,0.08)',
    padding: 14,
  },
  inviteCopy: { flex: 1, gap: 2 },
  inviteLabel: { color: ELECTRIC, fontSize: 12, fontWeight: '700' },
  inviteName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  accept: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: ELECTRIC,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(5, 12, 32, 0.94)',
    borderWidth: 1.5,
    borderColor: ELECTRIC,
    shadowColor: ELECTRIC,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  cardArt: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,254,0.28)',
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 12,
  },
  eventName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  datePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(8, 18, 42, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  datePillText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  locationIcon: {
    marginTop: 1,
    textShadowColor: ELECTRIC,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  locationText: {
    flex: 1,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    lineHeight: 19,
  },
  accessBtn: {
    marginTop: 2,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: ELECTRIC,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    shadowColor: ELECTRIC,
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  accessBtnSide: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessBtnText: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  pressed: { opacity: 0.86 },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalCard: { width: '100%' },
  modalIcon: { alignSelf: 'center', marginBottom: 10 },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  modalText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
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
  modalLeaveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
