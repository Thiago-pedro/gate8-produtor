import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Loader } from '@/components/Loader';
import { colors, siteUrl } from '@/constants/theme';
import { batchTicketName, type EventBatch } from '@/lib/events';
import { formatDateTime } from '@/lib/format';
import {
  emitCourtesy,
  fetchCourtesyTickets,
  searchGate8Customers,
  type CourtesyTicket,
  type Gate8Customer,
} from '@/lib/courtesy';

type Mode = 'standalone' | 'customer';

const PAGE_SIZE = 6;

export function CortesiasSection({
  eventId,
  batches,
  ended,
  nonce,
  onToast,
  onIssued,
}: {
  eventId: string;
  batches: EventBatch[];
  ended: boolean;
  nonce: number;
  onToast: (message: string) => void;
  onIssued: () => void;
}) {
  const [mode, setMode] = useState<Mode>('standalone');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Gate8Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [customer, setCustomer] = useState<Gate8Customer | null>(null);
  const [batchId, setBatchId] = useState(batches[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState<'email' | 'emit' | 'copy' | null>(null);
  const [list, setList] = useState<CourtesyTicket[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [page, setPage] = useState(1);

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const visible = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage((current) => Math.min(current, pages));
  }, [pages]);
  const batch = batches.find((item) => item.id === batchId) ?? batches[0] ?? null;
  const remaining = batch ? Math.max(0, batch.quantity - batch.sold) : 0;
  const soldOut = Boolean(batch && batch.quantity > 0 && remaining <= 0);
  const maxQty = remaining > 0 ? remaining : 99;

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      setList(await fetchCourtesyTickets(eventId));
      setPage(1);
    } catch {
      setList([]);
      setPage(1);
    } finally {
      setLoadingList(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadList();
  }, [loadList, nonce]);

  useEffect(() => {
    if (batchId && batches.some((item) => item.id === batchId)) return;
    const firstOpen = batches.find((item) => item.quantity <= 0 || item.sold < item.quantity);
    setBatchId(firstOpen?.id ?? batches[0]?.id ?? '');
  }, [batchId, batches]);

  useEffect(() => {
    setQuantity((value) => Math.min(Math.max(1, value), maxQty));
  }, [maxQty]);

  useEffect(() => {
    if (mode !== 'customer' || customer || query.trim().length < 2) {
      setHits([]);
      return;
    }
    const handle = setTimeout(() => {
      setSearching(true);
      void searchGate8Customers(eventId, query)
        .then(setHits)
        .catch(() => setHits([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [customer, eventId, mode, query]);

  function resetForm() {
    setName('');
    setEmail('');
    setQuery('');
    setHits([]);
    setCustomer(null);
    setQuantity(1);
  }

  function pickCustomer(hit: Gate8Customer) {
    setCustomer(hit);
    setName(hit.name);
    setEmail(hit.email);
    setQuery(`${hit.name} · ${hit.email}`);
    setHits([]);
  }

  function clearCustomer() {
    setCustomer(null);
    setName('');
    setEmail('');
    setQuery('');
    setHits([]);
  }

  async function submit(sendEmail: boolean, copyLink = false) {
    if (!batch) {
      onToast('Selecione um lote.');
      return;
    }
    setBusy(copyLink ? 'copy' : sendEmail ? 'email' : 'emit');
    try {
      const result = await emitCourtesy({
        eventId,
        batch,
        quantity,
        holderName: name,
        holderEmail: email,
        mode,
        customer,
        sendEmail,
      });
      if (copyLink && result.codes.length > 0) {
        await Clipboard.setStringAsync(
          result.codes.map((code) => `${siteUrl}/ingressos/${code}`).join('\n')
        );
      }
      const countLabel = `${result.count} cortesia${result.count === 1 ? '' : 's'}`;
      const who = (customer?.name || name).trim();
      let message = '';
      if (mode === 'customer') {
        message = result.linked
          ? `${countLabel} na carteira Gate8 de ${who}.`
          : `${countLabel} emitida${result.count === 1 ? '' : 's'} para ${who}, mas não entrou na carteira.`;
      } else {
        message = `${countLabel} avulsa${result.count === 1 ? '' : 's'} emitida${result.count === 1 ? '' : 's'} para ${who}.`;
      }
      if (sendEmail && result.emailed > 0) {
        message += ` E-mail enviado para ${email.trim()}.`;
      }
      if (copyLink) {
        message += result.codes.length > 1 ? ' Links copiados.' : ' Link copiado.';
      }
      onToast(message);
      resetForm();
      await loadList();
      onIssued();
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : 'Não foi possível emitir a cortesia.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.block}>
      <Text style={styles.title}>Cortesias</Text>
      <Text style={styles.copy}>
        Emita um ingresso grátis avulso ou coloque direto na carteira de quem já tem conta Gate8.
      </Text>

      {ended ? (
        <Text style={styles.empty}>Evento encerrado. Não dá mais para emitir cortesia.</Text>
      ) : (
        <View style={styles.card}>
          <Text style={styles.lead}>Preencha os dados, escolha o lote e emita a cortesia.</Text>
          <View style={styles.modeRow}>
            <Pressable
              onPress={() => {
                setMode('standalone');
                clearCustomer();
              }}
              style={[styles.mode, mode === 'standalone' && styles.modeOn]}
            >
              <Ionicons
                name="ticket-outline"
                size={16}
                color={mode === 'standalone' ? colors.blue : 'rgba(255,255,255,0.45)'}
              />
              <Text style={[styles.modeTitle, mode === 'standalone' && styles.modeTitleOn]}>Avulso</Text>
              <Text style={styles.modeHint}>Sem conta do cliente</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMode('customer');
                setName('');
                setEmail('');
                setQuery('');
                setCustomer(null);
              }}
              style={[styles.mode, mode === 'customer' && styles.modeOn]}
            >
              <Ionicons
                name="person-outline"
                size={16}
                color={mode === 'customer' ? colors.blue : 'rgba(255,255,255,0.45)'}
              />
              <Text style={[styles.modeTitle, mode === 'customer' && styles.modeTitleOn]}>Cliente</Text>
              <Text style={styles.modeHint}>Entra na carteira Gate8</Text>
            </Pressable>
          </View>

          {mode === 'customer' ? (
            <View>
              <Text style={styles.label}>Buscar cliente *</Text>
              {customer ? (
                <View style={styles.picked}>
                  <Ionicons name="person-circle-outline" size={22} color={colors.blue} />
                  <View style={styles.pickedInfo}>
                    <Text style={styles.pickedName}>{customer.name}</Text>
                    <Text style={styles.pickedEmail}>{customer.email}</Text>
                  </View>
                  <Pressable onPress={clearCustomer} hitSlop={10}>
                    <Ionicons name="close" size={18} color={colors.muted} />
                  </Pressable>
                </View>
              ) : (
                <>
                  <View>
                    <Ionicons
                      name="search-outline"
                      size={16}
                      color="rgba(255,255,255,0.4)"
                      style={styles.searchIcon}
                    />
                    <TextInput
                      value={query}
                      onChangeText={(value) => {
                        setQuery(value);
                        setCustomer(null);
                      }}
                      placeholder="Digite o nome ou e-mail da conta Gate8"
                      placeholderTextColor="rgba(255,255,255,0.28)"
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={[styles.input, styles.searchInput]}
                    />
                    {searching ? (
                      <ActivityIndicator size="small" color={colors.blue} style={styles.searchSpin} />
                    ) : null}
                  </View>
                  {query.trim().length >= 2 && !searching ? (
                    <View style={styles.hits}>
                      {hits.length === 0 ? (
                        <Text style={styles.noHit}>Nenhuma conta Gate8 encontrada.</Text>
                      ) : (
                        hits.map((hit) => (
                          <Pressable key={hit.id} onPress={() => pickCustomer(hit)} style={styles.hit}>
                            <Ionicons name="person-outline" size={16} color={colors.blue} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.hitName}>{hit.name}</Text>
                              <Text style={styles.hitEmail}>{hit.email}</Text>
                            </View>
                          </Pressable>
                        ))
                      )}
                    </View>
                  ) : null}
                </>
              )}
            </View>
          ) : (
            <>
              <Text style={styles.label}>Nome do comprador *</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Nome completo"
                placeholderTextColor="rgba(255,255,255,0.28)"
                style={styles.input}
              />
              <Text style={styles.label}>E-mail</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="email@conta.com"
                placeholderTextColor="rgba(255,255,255,0.28)"
                style={styles.input}
              />
            </>
          )}

          <Text style={styles.label}>Lote</Text>
          <Pressable onPress={() => setPickerOpen((open) => !open)} style={styles.input}>
            <Text style={batch ? styles.inputText : styles.placeholder}>
              {batch ? batchTicketName(batch) : 'Selecione um lote'}
            </Text>
          </Pressable>
          {pickerOpen
            ? batches.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setBatchId(item.id);
                    setPickerOpen(false);
                  }}
                  style={[styles.hit, item.id === batchId && styles.hitOn]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hitName}>{batchTicketName(item)}</Text>
                    <Text style={styles.hitEmail}>
                      {item.sold}/{item.quantity} · {item.sector || 'Lote'}
                    </Text>
                  </View>
                </Pressable>
              ))
            : null}

          <Text style={styles.label}>Quantidade</Text>
          <View style={styles.qty}>
            <Pressable
              onPress={() => setQuantity((value) => Math.max(1, value - 1))}
              style={styles.qtyBtn}
            >
              <Ionicons name="remove" size={18} color={colors.text} />
            </Pressable>
            <Text style={styles.qtyValue}>{quantity}</Text>
            <Pressable
              onPress={() => setQuantity((value) => Math.min(maxQty, value + 1))}
              style={styles.qtyBtn}
            >
              <Ionicons name="add" size={18} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.gift}>
            <Ionicons name="gift-outline" size={16} color={colors.blue} />
            <Text style={styles.giftText}>Cortesia / brinde — nenhum valor será cobrado.</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalMuted}>
              {quantity} × Cortesia
            </Text>
            <Text style={styles.totalMuted}>Grátis</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>Grátis</Text>
          </View>

          <Pressable
            onPress={() => void submit(true)}
            disabled={Boolean(busy) || !batch || soldOut}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed, (busy || !batch || soldOut) && styles.off]}
          >
            {busy === 'email' ? (
              <ActivityIndicator color={colors.loginText} />
            ) : (
              <>
                <Ionicons name="mail-outline" size={16} color={colors.loginText} />
                <Text style={styles.primaryText}>Emitir e enviar por e-mail</Text>
              </>
            )}
          </Pressable>
          <Pressable
            onPress={() => void submit(false, mode === 'standalone')}
            disabled={Boolean(busy) || !batch || soldOut}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed, (busy || !batch || soldOut) && styles.off]}
          >
            {busy === 'emit' || busy === 'copy' ? (
              <ActivityIndicator color={colors.text} />
            ) : mode === 'standalone' ? (
              <>
                <Ionicons name="link-outline" size={16} color={colors.text} />
                <Text style={styles.secondaryText}>Copiar link do ingresso</Text>
              </>
            ) : (
              <>
                <Ionicons name="gift-outline" size={16} color={colors.text} />
                <Text style={styles.secondaryText}>Emitir cortesia</Text>
              </>
            )}
          </Pressable>
          {soldOut ? (
            <Text style={styles.stock}>Este lote está esgotado.</Text>
          ) : remaining > 0 ? (
            <Text style={styles.stock}>Restam {remaining} neste lote.</Text>
          ) : batches.length === 0 ? (
            <Text style={styles.stock}>Cadastre um lote antes de emitir cortesia.</Text>
          ) : null}
        </View>
      )}

      <Text style={[styles.title, styles.listTitle]}>Emitidas</Text>
      {loadingList ? (
        <View style={styles.boot}>
          <Loader size={120} />
        </View>
      ) : list.length === 0 ? (
        <Text style={styles.empty}>Nenhuma cortesia emitida ainda.</Text>
      ) : (
        <>
          {visible.map((item) => {
            const lot = batches.find((batchItem) => batchItem.id === item.batchId);
            return (
              <View key={item.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{item.holder}</Text>
                  {item.email ? <Text style={styles.rowMeta}>{item.email}</Text> : null}
                  <Text style={styles.rowMeta}>
                    {item.code}
                    {item.createdAt ? ` · ${formatDateTime(item.createdAt)}` : ''}
                    {lot ? ` · ${batchTicketName(lot)}` : ''}
                  </Text>
                </View>
                <Text style={styles.badge}>Cortesia</Text>
              </View>
            );
          })}
          {pages > 1 ? (
            <View style={styles.pager}>
              <Pressable
                onPress={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                style={[styles.pagerBtn, page <= 1 && styles.off]}
              >
                <Ionicons name="chevron-back" size={18} color={colors.text} />
              </Pressable>
              <Text style={styles.pagerText}>
                Página {page} de {pages}
              </Text>
              <Pressable
                onPress={() => setPage((current) => Math.min(pages, current + 1))}
                disabled={page >= pages}
                style={[styles.pagerBtn, page >= pages && styles.off]}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.text} />
              </Pressable>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 18, gap: 10 },
  boot: { minHeight: 120, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  listTitle: { marginTop: 8 },
  copy: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  empty: { color: colors.muted, fontSize: 13 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(0,123,255,0.45)',
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  lead: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  modeRow: { flexDirection: 'row', gap: 8 },
  mode: {
    flex: 1,
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    gap: 2,
  },
  modeOn: {
    borderColor: colors.blue,
    backgroundColor: 'rgba(0,123,255,0.15)',
  },
  modeTitle: { color: 'rgba(255,255,255,0.6)', fontWeight: '700', fontSize: 14 },
  modeTitleOn: { color: colors.text },
  modeHint: { color: 'rgba(255,255,255,0.45)', fontSize: 11 },
  label: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: colors.text,
    paddingHorizontal: 12,
    justifyContent: 'center',
    fontSize: 14,
  },
  searchInput: { paddingLeft: 36, paddingRight: 36 },
  searchIcon: { position: 'absolute', left: 12, top: 16, zIndex: 1 },
  searchSpin: { position: 'absolute', right: 12, top: 14 },
  inputText: { color: colors.text, fontSize: 14 },
  placeholder: { color: 'rgba(255,255,255,0.28)', fontSize: 14 },
  picked: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,123,255,0.6)',
    backgroundColor: 'rgba(0,123,255,0.10)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pickedInfo: { flex: 1, minWidth: 0 },
  pickedName: { color: colors.text, fontWeight: '700', fontSize: 14 },
  pickedEmail: { color: colors.muted, fontSize: 12 },
  hits: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  noHit: { color: colors.muted, fontSize: 12, textAlign: 'center', paddingVertical: 16 },
  hit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  hitOn: { backgroundColor: 'rgba(0,123,255,0.12)' },
  hitName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  hitEmail: { color: colors.muted, fontSize: 12 },
  qty: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4 },
  qtyBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: { color: colors.text, fontSize: 16, fontWeight: '700', minWidth: 36, textAlign: 'center' },
  gift: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,123,255,0.4)',
    backgroundColor: 'rgba(0,123,255,0.10)',
    padding: 12,
  },
  giftText: { color: colors.muted, fontSize: 12, flex: 1, lineHeight: 18 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalMuted: { color: colors.muted, fontSize: 13 },
  totalLabel: { color: colors.text, fontWeight: '700', fontSize: 14 },
  totalValue: { color: colors.text, fontWeight: '800', fontSize: 16 },
  primary: {
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.blue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: { color: colors.loginText, fontWeight: '700', fontSize: 14 },
  secondary: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  stock: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  off: { opacity: 0.7 },
  pressed: { opacity: 0.86 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: 12,
  },
  rowName: { color: colors.text, fontWeight: '700', fontSize: 14 },
  rowMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  badge: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  pagerBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagerText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
});
