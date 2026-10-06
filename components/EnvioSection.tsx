import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Loader } from '@/components/Loader';
import { colors } from '@/constants/theme';
import { countValidatedTickets } from '@/lib/events';
import { formatDateTime } from '@/lib/format';
import {
  activeTickets,
  addDeliveryTickets,
  archiveDeliveryGuest,
  cancelDeliveryTicket,
  createDeliveryGuest,
  fetchDeliveryGuests,
  guestCounts,
  sendDeliveryInvite,
  type DeliveryGuest,
} from '@/lib/ticket-delivery';

const PAGE_SIZE = 8;

export function EnvioSection({
  eventId,
  nonce,
  onToast,
}: {
  eventId: string;
  nonce: number;
  onToast: (message: string) => void;
}) {
  const [guests, setGuests] = useState<DeliveryGuest[] | null>(null);
  const [validatedTotal, setValidatedTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [custom, setCustom] = useState('');
  const [full, setFull] = useState('1');
  const [half, setHalf] = useState('0');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [kind, setKind] = useState<'full' | 'half'>('full');
  const [quantity, setQuantity] = useState('1');

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [nextGuests, total] = await Promise.all([
        fetchDeliveryGuests(eventId),
        countValidatedTickets(eventId),
      ]);
      setGuests(nextGuests);
      if (total != null) setValidatedTotal(total);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os participantes.');
    } finally {
      setBusy(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load, nonce]);

  const issued = useMemo(
    () => (guests ?? []).reduce((sum, guest) => sum + activeTickets(guest).length, 0),
    [guests]
  );
  const validated = useMemo(() => {
    if (validatedTotal != null) return validatedTotal;
    return (guests ?? []).reduce((sum, guest) => sum + guestCounts(guest).validated, 0);
  }, [guests, validatedTotal]);
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR');
    return (guests ?? []).filter((guest) => {
      if (!term) return true;
      return [guest.name, guest.email, guest.custom ?? ''].some((value) =>
        value.toLocaleLowerCase('pt-BR').includes(term)
      );
    });
  }, [guests, query]);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageRows = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [query]);

  async function addGuest() {
    const fullCount = Number(full) || 0;
    const halfCount = Number(half) || 0;
    if (!name.trim() || fullCount + halfCount < 1) {
      onToast('Informe nome e ao menos um ingresso.');
      return;
    }
    setAdding(true);
    try {
      await createDeliveryGuest({
        eventId,
        name,
        email,
        full: fullCount,
        half: halfCount,
        custom,
      });
      setName('');
      setEmail('');
      setCustom('');
      setFull('1');
      setHalf('0');
      onToast('Participante e ingressos adicionados');
      setGuests(await fetchDeliveryGuests(eventId));
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : 'Não foi possível adicionar.');
    } finally {
      setAdding(false);
    }
  }

  async function sendPending() {
    const pending = (guests ?? []).filter((guest) => guest.email && !guest.emailSentAt);
    if (pending.length === 0) {
      onToast('Nenhum convite pendente de envio.');
      return;
    }
    setSendingAll(true);
    let sent = 0;
    for (const guest of pending) {
      try {
        await sendDeliveryInvite(guest.id);
        sent += 1;
      } catch {
        // segue para o próximo
      }
    }
    setSendingAll(false);
    onToast(`${sent} convite(s) enviado(s)`);
    setGuests(await fetchDeliveryGuests(eventId));
  }

  async function sendOne(guest: DeliveryGuest) {
    if (!guest.email) {
      onToast('Cadastre um e-mail para este participante.');
      return;
    }
    try {
      await sendDeliveryInvite(guest.id);
      onToast(`Convite enviado para ${guest.email}`);
      setGuests(await fetchDeliveryGuests(eventId));
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : 'Não foi possível enviar o convite.');
    }
  }

  async function addTickets(guestId: string) {
    const count = Math.min(50, Math.max(1, Number(quantity) || 1));
    try {
      await addDeliveryTickets(guestId, kind, count);
      onToast('Ingressos adicionados');
      setGuests(await fetchDeliveryGuests(eventId));
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : 'Não foi possível adicionar ingressos.');
    }
  }

  function removeGuest(guest: DeliveryGuest) {
    Alert.alert('Excluir participante', `Excluir ${guest.name} e os ingressos não validados?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await archiveDeliveryGuest(guest.id);
              onToast('Participante e ingressos excluídos');
              setGuests(await fetchDeliveryGuests(eventId));
            } catch {
              onToast('Ingressos já validados não podem ser excluídos.');
            }
          })();
        },
      },
    ]);
  }

  if (busy && !guests) {
    return (
      <View style={styles.boot}>
        <Loader size={148} />
      </View>
    );
  }
  if (error && !guests) return <Text style={styles.empty}>{error}</Text>;

  return (
    <View style={styles.block}>
      <View style={styles.stats}>
        <Mini label="Participantes" value={String(guests?.length ?? 0)} />
        <Mini label="Ingressos emitidos" value={String(issued)} />
        <Mini label="Validados" value={String(validated)} />
      </View>

      <View style={styles.form}>
        <Text style={styles.formTitle}>Adicionar participante</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Nome"
          placeholderTextColor="rgba(255,255,255,0.32)"
          style={styles.input}
        />
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="E-mail"
          placeholderTextColor="rgba(255,255,255,0.32)"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          value={custom}
          onChangeText={setCustom}
          placeholder="Campo (turma, matrícula...)"
          placeholderTextColor="rgba(255,255,255,0.32)"
          style={styles.input}
        />
        <View style={styles.qtyRow}>
          <Qty label="Inteira" value={full} onChange={setFull} />
          <Qty label="Meia" value={half} onChange={setHalf} />
        </View>
        <Pressable
          onPress={() => void addGuest()}
          disabled={adding}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed, adding && styles.off]}
        >
          <Text style={styles.primaryText}>{adding ? 'Adicionando...' : 'Adicionar participante'}</Text>
        </Pressable>
        <Pressable
          onPress={() => void sendPending()}
          disabled={sendingAll}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed, sendingAll && styles.off]}
        >
          <Text style={styles.secondaryText}>{sendingAll ? 'Enviando...' : 'Enviar pendentes'}</Text>
        </Pressable>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar participante, e-mail ou campo..."
        placeholderTextColor="rgba(255,255,255,0.32)"
        style={styles.input}
      />
      {visible.length === 0 ? <Text style={styles.empty}>Nenhum participante encontrado.</Text> : null}
      {pageRows.map((guest) => {
        const counts = guestCounts(guest);
        const expanded = expandedId === guest.id;
        const open = openId === guest.id;
        const transferred = guest.creationSource === 'ticket_transfer';
        return (
          <View key={guest.id} style={[styles.card, transferred && styles.cardTransfer]}>
            <Pressable
              onPress={() => setExpandedId(expanded ? null : guest.id)}
              style={styles.head}
            >
              <Ionicons
                name={expanded ? 'chevron-down' : 'chevron-forward'}
                size={18}
                color={colors.muted}
              />
              <Text style={styles.name} numberOfLines={1}>
                {guest.name}
              </Text>
              <View style={styles.balance}>
                <Text style={styles.balanceValue}>{counts.current}</Text>
                <Text style={styles.balanceLabel}>Saldo atual</Text>
              </View>
            </Pressable>
            {expanded ? (
              <>
            <Text style={styles.email}>{guest.email || 'Sem e-mail'}{guest.custom ? ` · ${guest.custom}` : ''}</Text>
            <Text style={styles.source}>
              {guest.creationSource === 'ticket_transfer' ? 'Criado por transferência' : 'Criado no sistema'}
              {' · '}
              {guest.lastViewedAt ? 'Visualizado' : 'Pendente'}
              {guest.emailSentAt ? '' : ' · E-mail não enviado'}
            </Text>
            <View style={styles.countGrid}>
              <Count label="Saldo inicial" value={counts.initial} />
              <Count label="Inteira" value={counts.full} />
              <Count label="Meia" value={counts.half} />
              <Count label="Validados" value={counts.validated} />
              <Count label="Transferidos" value={guest.transferredOut} />
              <Count label="Recebidos" value={guest.transferredIn} />
              <Count label="Saldo atual" value={counts.current} />
            </View>
            {guest.lastViewedAt ? (
              <Text style={styles.viewed}>
                {formatDateTime(guest.lastViewedAt)}
                {guest.viewedDevice ? ` · ${guest.viewedDevice}` : ''}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Pressable onPress={() => void sendOne(guest)} style={styles.action}>
                <Text style={styles.actionText}>Enviar</Text>
              </Pressable>
              <Pressable
                onPress={() => setOpenId(open ? null : guest.id)}
                style={styles.action}
              >
                <Text style={styles.actionText}>{open ? 'Fechar' : 'Ingressos'}</Text>
              </Pressable>
              <Pressable onPress={() => removeGuest(guest)} style={styles.action}>
                <Text style={styles.actionDanger}>Excluir</Text>
              </Pressable>
            </View>
            {open ? (
              <View style={styles.manage}>
                {activeTickets(guest).map((ticket) => (
                  <View key={ticket.id} style={styles.ticketRow}>
                    <Text style={styles.ticketCode}>
                      {ticket.kind === 'half' ? 'Meia' : 'Inteira'} · {(ticket.code || ticket.id).slice(0, 8)}
                      {ticket.status === 'used' ? ' · validado' : ''}
                    </Text>
                    {ticket.status === 'used' ? null : (
                      <Pressable
                        onPress={() => {
                          void (async () => {
                            try {
                              await cancelDeliveryTicket(guest.id, ticket.id);
                              onToast('Ingresso cancelado');
                              setGuests(await fetchDeliveryGuests(eventId));
                            } catch (caught) {
                              onToast(
                                caught instanceof Error ? caught.message : 'Não foi possível cancelar.'
                              );
                            }
                          })();
                        }}
                      >
                        <Text style={styles.actionDanger}>Cancelar</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
                <View style={styles.filters}>
                  <Pressable
                    onPress={() => setKind('full')}
                    style={[styles.filter, kind === 'full' && styles.filterOn]}
                  >
                    <Text style={[styles.filterText, kind === 'full' && styles.filterTextOn]}>Inteira</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setKind('half')}
                    style={[styles.filter, kind === 'half' && styles.filterOn]}
                  >
                    <Text style={[styles.filterText, kind === 'half' && styles.filterTextOn]}>Meia</Text>
                  </Pressable>
                </View>
                <Qty label="Quantidade" value={quantity} onChange={setQuantity} />
                <Pressable onPress={() => void addTickets(guest.id)} style={styles.secondary}>
                  <Text style={styles.secondaryText}>Adicionar ingresso</Text>
                </Pressable>
              </View>
            ) : null}
              </>
            ) : null}
          </View>
        );
      })}
      {visible.length > PAGE_SIZE ? (
        <View style={styles.pager}>
          <Pressable
            onPress={() => {
              setExpandedId(null);
              setPage((current) => Math.max(1, Math.min(current, pages) - 1));
            }}
            disabled={currentPage <= 1}
            style={[styles.pagerBtn, currentPage <= 1 && styles.off]}
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.pagerText}>
            Página {currentPage} de {pages}
          </Text>
          <Pressable
            onPress={() => {
              setExpandedId(null);
              setPage((current) => Math.min(pages, Math.min(current, pages) + 1));
            }}
            disabled={currentPage >= pages}
            style={[styles.pagerBtn, currentPage >= pages && styles.off]}
          >
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.mini}>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.count}>
      <Text style={styles.countValue}>{value}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

function Qty({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.qty}>
      <Text style={styles.countLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(next) => onChange(next.replace(/[^0-9]/g, '').slice(0, 2))}
        keyboardType="number-pad"
        style={styles.qtyInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  boot: { minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  block: { gap: 10 },
  stats: { flexDirection: 'row', gap: 8 },
  mini: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 10,
  },
  miniValue: { color: colors.text, fontSize: 18, fontWeight: '700' },
  miniLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
  form: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: 12,
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  formTitle: { color: colors.text, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  qtyRow: { flexDirection: 'row', gap: 8 },
  qty: { flex: 1, gap: 4 },
  qtyInput: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  primary: {
    backgroundColor: colors.blue,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  primaryText: { color: colors.loginText, fontWeight: '700' },
  secondary: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryText: { color: colors.text, fontWeight: '600' },
  pressed: { opacity: 0.8 },
  off: { opacity: 0.5 },
  filters: { flexDirection: 'row', gap: 8 },
  filter: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  filterOn: { backgroundColor: colors.blue },
  filterText: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  filterTextOn: { color: colors.loginText },
  empty: { color: colors.muted, textAlign: 'center', paddingVertical: 16 },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: 12,
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cardTransfer: {
    borderColor: 'rgba(255, 92, 122, 0.42)',
    backgroundColor: 'rgba(255, 92, 122, 0.12)',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, color: colors.text, fontWeight: '700', fontSize: 15 },
  balance: { alignItems: 'flex-end' },
  balanceValue: { color: colors.text, fontWeight: '700', fontSize: 16 },
  balanceLabel: { color: colors.muted, fontSize: 10 },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 4,
  },
  pagerBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagerText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  email: { color: colors.muted, fontSize: 12 },
  source: { color: colors.blue, fontSize: 12 },
  countGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  count: { width: '30%', minWidth: 90 },
  countValue: { color: colors.text, fontWeight: '700' },
  countLabel: { color: colors.muted, fontSize: 11 },
  viewed: { color: colors.muted, fontSize: 11 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  action: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  actionText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  actionDanger: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  manage: { gap: 8, marginTop: 6 },
  ticketRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' },
  ticketCode: { color: colors.text, fontSize: 12, flex: 1 },
});
