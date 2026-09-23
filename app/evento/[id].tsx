import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Loader } from '@/components/Loader';
import { Wordmark } from '@/components/Wordmark';
import { colors, siteUrl } from '@/constants/theme';
import { fetchProducerEventDetail, type ProducerEventDetail } from '@/lib/events';
import {
  fetchEventFinance,
  FINANCE_PAGE_SIZE,
  paymentLabel,
  type EventFinance,
  type FinanceChannel,
  type FinancePurchase,
} from '@/lib/finance';
import { formatBRL, formatCheckinAt, formatEventDateTime, formatFinanceAt } from '@/lib/format';

const HISTORY_PAGE_SIZE = 10;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ChannelCard({
  title,
  accent,
  netColor,
  bankLabel,
  data,
}: {
  title: string;
  accent: string;
  netColor: string;
  bankLabel: string;
  data: FinanceChannel;
}) {
  return (
    <View style={[styles.channelCard, { borderLeftColor: accent }]}>
      <View style={styles.channelTop}>
        <Text style={styles.channelTitle}>{title}</Text>
        <Text style={styles.channelCount}>
          {data.count} ingresso{data.count === 1 ? '' : 's'}
        </Text>
      </View>
      <View style={styles.channelGrid}>
        <View style={styles.channelCell}>
          <Text style={styles.channelLabel}>Bruto</Text>
          <Text style={styles.channelValue}>{formatBRL(data.gross)}</Text>
        </View>
        <View style={styles.channelCell}>
          <Text style={styles.channelLabel}>{bankLabel}</Text>
          <Text style={styles.channelMuted}>- {formatBRL(data.bank)}</Text>
        </View>
        <View style={styles.channelCell}>
          <Text style={styles.channelLabel}>Taxa Gate8</Text>
          <Text style={styles.channelMuted}>- {formatBRL(data.gate8)}</Text>
        </View>
        <View style={styles.channelCell}>
          <Text style={styles.channelLabel}>Líquido</Text>
          <Text style={[styles.channelValue, { color: netColor }]}>{formatBRL(data.net)}</Text>
        </View>
      </View>
    </View>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'coupon' | 'net';
}) {
  return (
    <View
      style={[
        styles.kpi,
        tone === 'coupon' && styles.kpiCoupon,
        tone === 'net' && styles.kpiNet,
      ]}
    >
      <Text style={[styles.kpiLabel, tone === 'coupon' && styles.kpiCouponText]}>{label}</Text>
      <Text style={[styles.kpiValue, tone === 'coupon' && styles.kpiCouponText, tone === 'net' && styles.kpiNetText]}>
        {value}
      </Text>
      {hint ? <Text style={[styles.kpiHint, tone === 'coupon' && styles.kpiCouponHint]}>{hint}</Text> : null}
    </View>
  );
}

function PurchaseCard({ item, producerMode }: { item: FinancePurchase; producerMode: boolean }) {
  const method = paymentLabel(item.method, item.isCourtesy, item.isCancelled);
  const parcels =
    !item.isCancelled && item.method === 'credit_card' ? `${item.installments}x` : '—';
  return (
    <View
      style={[
        styles.purchase,
        item.isCancelled && styles.purchaseCancelled,
        item.couponCode && styles.purchaseCoupon,
      ]}
    >
      <View style={styles.purchaseTop}>
        <View style={styles.purchaseLeft}>
          <Text style={styles.purchaseCode}>
            {item.purchaseCode ? `Compra ${item.purchaseCode}` : item.sampleCode.slice(0, 8).toUpperCase()}
          </Text>
          <Text style={styles.purchaseMeta}>
            {item.purchaseCode
              ? `${item.ticketCount} ingresso${item.ticketCount > 1 ? 's' : ''}`
              : 'Avulso'}
            {' · '}
            {formatFinanceAt(item.createdAt)}
          </Text>
        </View>
        <View style={styles.purchaseRight}>
          <Text style={styles.channelLabel}>Líquido</Text>
          <Text style={styles.purchaseNet}>{formatBRL(item.net)}</Text>
        </View>
      </View>
      <Text style={styles.purchaseBuyer}>{item.buyer}</Text>
      <View style={styles.purchaseRow}>
        <Text
          style={[
            styles.purchasePay,
            item.isCourtesy && styles.purchaseCourtesy,
            item.isCancelled && styles.purchaseStrike,
          ]}
        >
          {method}
          {!item.isCancelled && item.method === 'credit_card' ? ` · ${parcels}` : ''}
        </Text>
        <Text style={styles.purchaseMeta}>Bruto {formatBRL(item.financialGross)}</Text>
      </View>
      <View style={styles.purchaseFees}>
        <Text style={styles.purchaseFee}>- serviço {formatBRL(item.serviceFee)}</Text>
        {producerMode ? null : (
          <Text style={styles.purchaseFee}>
            - banco {formatBRL(item.bankFee)}
            {item.snapshotBankPercent != null
              ? ` (${item.snapshotBankPercent.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}%)`
              : ''}
          </Text>
        )}
      </View>
    </View>
  );
}

function Row({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Ionicons name={icon} size={18} color={colors.blue} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
}

export default function EventoScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<ProducerEventDetail | null>(null);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<'resumo' | 'portaria' | 'historico' | 'financeiro'>('resumo');
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [historyPage, setHistoryPage] = useState(0);
  const [finance, setFinance] = useState<EventFinance | null>(null);
  const [financeBusy, setFinanceBusy] = useState(false);
  const [financeError, setFinanceError] = useState<string | null>(null);
  const [financePage, setFinancePage] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copyText(value: string, message: string) {
    await Clipboard.setStringAsync(value);
    // Android 13+ already shows a system clipboard confirmation. A second toast stacks on it.
    if (Platform.OS === 'android') return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  useEffect(() => {
    setHistoryPage(0);
  }, [search, id]);

  useEffect(() => {
    setFinance(null);
    setFinanceError(null);
    setFinancePage(0);
    setFinanceBusy(false);
  }, [id]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const load = useCallback(
    async (soft = false) => {
      if (!id) return;
      if (!soft) setBusy(true);
      setError(null);
      try {
        setDetail(await fetchProducerEventDetail(id));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Não foi possível abrir o evento.');
      } finally {
        setBusy(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  const loadFinance = useCallback(async (soft = false) => {
    if (!id) return;
    if (!soft) setFinanceBusy(true);
    setFinanceError(null);
    try {
      setFinance(await fetchEventFinance(id));
    } catch (caught) {
      setFinanceError(
        caught instanceof Error ? caught.message : 'Não foi possível carregar o financeiro.'
      );
    } finally {
      setFinanceBusy(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (section !== 'financeiro' || !id || finance || financeBusy || financeError) return;
    void loadFinance();
  }, [section, id, finance, financeBusy, financeError, loadFinance]);

  if (busy && !detail) {
    return (
      <View style={styles.boot}>
        <Loader screen />
      </View>
    );
  }

  if (error && !detail) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Text style={styles.backText}>Voltar</Text>
        </Pressable>
        <Text style={styles.error}>{error}</Text>
      </SafeAreaView>
    );
  }

  if (!detail) return null;
  const { event, batches } = detail;
  const gateLink = event.slug ? `${siteUrl}/p/${event.slug}` : null;
  const query = search.trim().toLowerCase();
  const filteredCheckins = query
    ? detail.checkins.filter((item) =>
        `${item.code} ${item.holder} ${item.ticket}`.toLowerCase().includes(query)
      )
    : detail.checkins;
  const historyPages = Math.max(1, Math.ceil(filteredCheckins.length / HISTORY_PAGE_SIZE));
  const currentHistoryPage = Math.min(historyPage, historyPages - 1);
  const pagedCheckins = filteredCheckins.slice(
    currentHistoryPage * HISTORY_PAGE_SIZE,
    currentHistoryPage * HISTORY_PAGE_SIZE + HISTORY_PAGE_SIZE
  );
  const validatedPct = detail.sold > 0 ? (detail.validated / detail.sold) * 100 : 0;
  const validatedPctLabel =
    validatedPct === 0 ? '0%' : validatedPct < 10 ? `${validatedPct.toFixed(1)}%` : `${Math.round(validatedPct)}%`;
  const validatedBar = detail.validated > 0 ? Math.min(100, Math.max(validatedPct, 2)) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerSide}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Wordmark height={24} />
        <View style={styles.headerSide} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(true);
              if (section === 'financeiro') void loadFinance(true);
            }}
            tintColor={colors.blue}
          />
        }
      >
        {event.banner_url ? (
          <Image source={{ uri: event.banner_url }} style={styles.banner} />
        ) : (
          <View style={[styles.banner, styles.bannerEmpty]} />
        )}
        <Text style={styles.name}>{event.name}</Text>
        <Text style={styles.meta}>{formatEventDateTime(event.event_date)}</Text>
        {event.location ? <Text style={styles.meta}>{event.location}</Text> : null}

        <View style={styles.stats}>
          <Stat label="Vendidos" value={String(detail.sold)} />
          <Stat label="No lote" value={String(detail.quantity)} />
          <Stat label="Validados" value={String(detail.validated)} />
        </View>

        <View style={styles.tabs}>
          {(
            [
              ['resumo', 'Resumo'],
              ['portaria', 'Portaria'],
              ['historico', 'Validação'],
              ['financeiro', 'Financeiro'],
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setSection(key)}
              style={[styles.tab, section === key && styles.tabOn]}
            >
              <Text style={[styles.tabText, section === key && styles.tabTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {section === 'resumo' ? (
          <View style={styles.block}>
            <Text style={styles.section}>Lotes</Text>
            {batches.length === 0 ? <Text style={styles.empty}>Nenhum lote cadastrado.</Text> : null}
            {batches.map((batch) => {
              const soldOut = batch.sold >= batch.quantity && batch.quantity > 0;
              return (
                <View key={batch.id} style={styles.lot}>
                  <View style={styles.lotTop}>
                    <Text style={styles.lotName}>{batch.name}</Text>
                    <Text style={[styles.lotBadge, soldOut ? styles.lotSoldOut : batch.active === false ? styles.lotOff : styles.lotOn]}>
                      {soldOut ? 'Esgotado' : batch.active === false ? 'Pausado' : 'Ativo / À venda'}
                    </Text>
                  </View>
                  {batch.sector ? <Text style={styles.lotMeta}>{batch.sector}</Text> : null}
                  <Text style={styles.lotMeta}>
                    {formatBRL(batch.price)} · {batch.sold}/{batch.quantity} vendidos
                  </Text>
                </View>
              );
            })}

            <Text style={[styles.section, styles.sectionSpaced]}>Painel</Text>
            <Row icon="ticket-outline" label="Portaria" onPress={() => setSection('portaria')} />
            <Row icon="time-outline" label="Histórico de validação" onPress={() => setSection('historico')} />
            <Row icon="cash-outline" label="Financeiro" onPress={() => setSection('financeiro')} />
            <Row
              icon="create-outline"
              label="Editar evento no site"
              onPress={() => void Linking.openURL(`${siteUrl}/producer/eventos/${event.id}`)}
            />
            <Row
              icon="document-text-outline"
              label="Termos de uso"
              onPress={() => void Linking.openURL(`${siteUrl}/legal/termos`)}
            />
          </View>
        ) : null}

        {section === 'portaria' ? (
          <View style={styles.block}>
            <Text style={styles.section}>Token da portaria</Text>
            <Text style={styles.copy}>
              Use o token no app "Gate8 Portaria" para validar ingressos deste evento. Ou copie o link abaixo para validar em qualquer celular.
            </Text>
            {detail.token ? (
              <Pressable
                onPress={() => void copyText(detail.token ?? '', 'Token copiado para a área de transferência')}
                style={({ pressed }) => [styles.tokenBox, pressed && styles.pressed]}
              >
                <Text style={styles.token} selectable={false} pointerEvents="none">
                  {detail.token}
                </Text>
                <View style={styles.copyHint}>
                  <Ionicons name="copy-outline" size={14} color={colors.blue} />
                  <Text style={styles.copyHintText}>Toque para copiar</Text>
                </View>
              </Pressable>
            ) : (
              <Text style={styles.empty}>Ainda não há token neste evento. Gere no painel do site, em Portaria.</Text>
            )}
            {gateLink ? (
              <Pressable
                onPress={() => void copyText(gateLink, 'Link copiado para a área de transferência')}
                style={({ pressed }) => [styles.linkBox, pressed && styles.pressed]}
              >
                <Text style={styles.linkLabel}>Link de validação</Text>
                <Text style={styles.linkValue} numberOfLines={2} selectable={false} pointerEvents="none">
                  {gateLink}
                </Text>
                <View style={styles.copyHint}>
                  <Ionicons name="copy-outline" size={14} color={colors.blue} />
                  <Text style={styles.copyHintText}>Toque para copiar</Text>
                </View>
              </Pressable>
            ) : (
              <Text style={styles.empty}>Este evento ainda não tem link de validação.</Text>
            )}
          </View>
        ) : null}

        {section === 'historico' ? (
          <View style={styles.historyCard}>
            <View style={styles.historyTitleRow}>
              <Ionicons name="time-outline" size={18} color={colors.blue} />
              <Text style={styles.historyTitle}>Histórico de validações</Text>
            </View>
            <Text style={styles.historyEvent}>{event.name}</Text>

            <View style={styles.progressCard}>
              <View style={styles.progressTop}>
                <Text style={styles.progressLabel}>
                  {detail.validated} de {detail.sold} validados
                </Text>
                <Text style={styles.progressPct}>{validatedPctLabel}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${validatedBar}%` }]} />
              </View>
            </View>

            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={16} color={colors.muted} />
                <TextInput
                  value={search}
                  onChangeText={(value) => {
                    setSearch(value);
                    setHistoryPage(0);
                  }}
                  placeholder="Buscar código, nome..."
                  placeholderTextColor="rgba(255,255,255,0.32)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.searchInput}
                />
              </View>
              <Pressable
                onPress={() => {
                  setRefreshing(true);
                  void load(true);
                }}
                style={({ pressed }) => [styles.refreshBtn, pressed && styles.pressed]}
              >
                <Ionicons name="refresh" size={16} color={colors.text} />
                <Text style={styles.refreshText}>Atualizar</Text>
              </Pressable>
            </View>

            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colWhen]}>Data/Hora</Text>
              <Text style={[styles.th, styles.colCode]}>Código</Text>
              <Text style={[styles.th, styles.colHolder]}>Titular</Text>
              <Text style={[styles.th, styles.colTicket]}>Ingresso</Text>
            </View>

            {filteredCheckins.length === 0 ? (
              <Text style={styles.empty}>
                {detail.checkins.length === 0
                  ? 'Nenhum ingresso validado ainda.'
                  : 'Nenhum resultado para essa busca.'}
              </Text>
            ) : (
              pagedCheckins.map((item) => (
                <View key={item.id} style={styles.tableRow}>
                  <Text style={[styles.td, styles.colWhen]}>{formatCheckinAt(item.at) || '—'}</Text>
                  <Text style={[styles.td, styles.tdCode, styles.colCode]} numberOfLines={1}>
                    {item.code || '—'}
                  </Text>
                  <Text style={[styles.td, styles.colHolder]} numberOfLines={1}>
                    {item.holder}
                  </Text>
                  <Text style={[styles.td, styles.colTicket]} numberOfLines={2}>
                    {item.ticket}
                  </Text>
                </View>
              ))
            )}

            <View style={styles.pager}>
              <Text style={styles.pageHint}>
                Página {currentHistoryPage + 1} de {historyPages} · {filteredCheckins.length}{' '}
                {filteredCheckins.length === 1 ? 'resultado' : 'resultados'}
              </Text>
              <View style={styles.pagerBtns}>
                <Pressable
                  onPress={() => setHistoryPage(currentHistoryPage - 1)}
                  disabled={currentHistoryPage === 0}
                  style={({ pressed }) => [
                    styles.pagerBtn,
                    currentHistoryPage === 0 && styles.pagerBtnOff,
                    pressed && currentHistoryPage > 0 && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name="chevron-back"
                    size={16}
                    color={currentHistoryPage === 0 ? 'rgba(255,255,255,0.28)' : colors.text}
                  />
                </Pressable>
                <Pressable
                  onPress={() => setHistoryPage(currentHistoryPage + 1)}
                  disabled={currentHistoryPage >= historyPages - 1}
                  style={({ pressed }) => [
                    styles.pagerBtn,
                    currentHistoryPage >= historyPages - 1 && styles.pagerBtnOff,
                    pressed && currentHistoryPage < historyPages - 1 && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={currentHistoryPage >= historyPages - 1 ? 'rgba(255,255,255,0.28)' : colors.text}
                  />
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {section === 'financeiro' ? (
          <View style={styles.block}>
            {financeBusy && !finance ? (
              <View style={styles.financeBoot}>
                <Loader />
              </View>
            ) : financeError && !finance ? (
              <Text style={styles.empty}>{financeError}</Text>
            ) : finance ? (
              <>
                <ChannelCard
                  title="Site (PIX + Crédito)"
                  accent={colors.success}
                  netColor={colors.success}
                  bankLabel="Taxa Pagar.me"
                  data={finance.site}
                />
                <ChannelCard
                  title="POS (maquininha)"
                  accent={colors.warning}
                  netColor={colors.warning}
                  bankLabel="Taxa maquininha"
                  data={finance.pos}
                />
                {finance.pos.pixCount + finance.pos.creditCount + finance.pos.debitCount + finance.pos.cashCount >
                0 ? (
                  <View style={styles.posBreakdown}>
                    {[
                      { label: 'Dinheiro', value: finance.pos.cash, count: finance.pos.cashCount },
                      { label: 'Débito', value: finance.pos.debit, count: finance.pos.debitCount },
                      { label: 'Crédito', value: finance.pos.credit_card, count: finance.pos.creditCount },
                      { label: 'PIX', value: finance.pos.pix, count: finance.pos.pixCount },
                    ]
                      .filter((item) => item.count > 0)
                      .map((item) => (
                        <View key={item.label} style={styles.posLine}>
                          <Text style={styles.purchaseMeta}>
                            {item.label} · {item.count}
                          </Text>
                          <Text style={styles.purchaseMeta}>{formatBRL(item.value)}</Text>
                        </View>
                      ))}
                  </View>
                ) : null}

                <View style={styles.kpiGrid}>
                  <Kpi label="Ingressos pagos" value={String(finance.totals.paid)} />
                  <Kpi label="Cortesias" value={String(finance.totals.courtesy)} />
                  <Kpi
                    label="Desconto cupom"
                    value={formatBRL(finance.totals.couponDiscount)}
                    hint={`${finance.totals.couponCount} ${
                      finance.totals.couponCount === 1 ? 'compra com cupom' : 'compras com cupom'
                    }`}
                    tone="coupon"
                  />
                  <Kpi label="Bruto" value={formatBRL(finance.totals.gross)} />
                  <Kpi
                    label="Taxas"
                    value={formatBRL(finance.totals.serviceFee + finance.totals.bankFee)}
                    hint={
                      finance.producerMode
                        ? `Taxa produtor ${finance.producerPercent.toLocaleString('pt-BR')}%`
                        : `Serviço ${formatBRL(finance.totals.serviceFee)} + Banco ${formatBRL(finance.totals.bankFee)}`
                    }
                  />
                  <Kpi label="Líquido" value={formatBRL(finance.totals.net)} tone="net" />
                </View>

                <Text style={[styles.section, styles.sectionSpaced]}>Compras</Text>
                {finance.purchases.length === 0 ? (
                  <Text style={styles.empty}>Nenhum ingresso emitido.</Text>
                ) : (
                  finance.purchases
                    .slice(
                      financePage * FINANCE_PAGE_SIZE,
                      financePage * FINANCE_PAGE_SIZE + FINANCE_PAGE_SIZE
                    )
                    .map((item) => (
                      <PurchaseCard
                        key={item.key}
                        item={item}
                        producerMode={finance.producerMode}
                      />
                    ))
                )}
                {finance.purchases.length > FINANCE_PAGE_SIZE ? (
                  <View style={styles.pager}>
                    <Text style={styles.pageHint}>
                      {financePage * FINANCE_PAGE_SIZE + 1}–
                      {Math.min((financePage + 1) * FINANCE_PAGE_SIZE, finance.purchases.length)} de{' '}
                      {finance.purchases.length}
                    </Text>
                    <View style={styles.pagerBtns}>
                      <Pressable
                        disabled={financePage === 0}
                        onPress={() => setFinancePage((page) => Math.max(0, page - 1))}
                        style={({ pressed }) => [
                          styles.pagerBtn,
                          financePage === 0 && styles.pagerBtnOff,
                          pressed && financePage > 0 && styles.pressed,
                        ]}
                      >
                        <Ionicons
                          name="chevron-back"
                          size={16}
                          color={financePage === 0 ? 'rgba(255,255,255,0.28)' : colors.text}
                        />
                      </Pressable>
                      <Pressable
                        disabled={
                          financePage >= Math.ceil(finance.purchases.length / FINANCE_PAGE_SIZE) - 1
                        }
                        onPress={() =>
                          setFinancePage((page) =>
                            Math.min(
                              Math.ceil(finance.purchases.length / FINANCE_PAGE_SIZE) - 1,
                              page + 1
                            )
                          )
                        }
                        style={({ pressed }) => [
                          styles.pagerBtn,
                          financePage >= Math.ceil(finance.purchases.length / FINANCE_PAGE_SIZE) - 1 &&
                            styles.pagerBtnOff,
                          pressed &&
                            financePage < Math.ceil(finance.purchases.length / FINANCE_PAGE_SIZE) - 1 &&
                            styles.pressed,
                        ]}
                      >
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={
                            financePage >= Math.ceil(finance.purchases.length / FINANCE_PAGE_SIZE) - 1
                              ? 'rgba(255,255,255,0.28)'
                              : colors.text
                          }
                        />
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={styles.empty}>Nenhum dado financeiro neste evento.</Text>
            )}
          </View>
        ) : null}
      </ScrollView>
      {toast ? (
        <View pointerEvents="none" style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
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
    marginHorizontal: 8,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSide: {
    width: 32,
    height: 36,
    justifyContent: 'center',
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 4,
  },
  backText: {
    color: colors.text,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  banner: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    backgroundColor: colors.bgElevated,
    marginTop: 12,
  },
  bannerEmpty: {
    backgroundColor: colors.bgElevated,
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 14,
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  stats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  stat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tabs: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 18,
  },
  tab: {
    flex: 1,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tabOn: {
    backgroundColor: colors.blue,
  },
  tabText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextOn: {
    color: colors.loginText,
  },
  block: {
    marginTop: 18,
  },
  section: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  sectionSpaced: {
    marginTop: 18,
  },
  copy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  empty: {
    color: colors.muted,
    fontSize: 13,
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 16,
  },
  lot: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  lotTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'center',
  },
  lotName: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
    flex: 1,
  },
  lotBadge: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  lotOn: {
    color: '#4ade80',
    backgroundColor: 'rgba(74,222,128,0.15)',
  },
  lotOff: {
    color: colors.muted,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  lotSoldOut: {
    color: '#fb923c',
    backgroundColor: 'rgba(251,146,60,0.15)',
  },
  lotMeta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  pressed: {
    opacity: 0.7,
  },
  rowLabel: {
    color: colors.text,
    fontSize: 15,
    flex: 1,
  },
  tokenBox: {
    borderWidth: 1,
    borderColor: colors.blue,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(0,123,255,0.08)',
    marginBottom: 12,
  },
  token: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 4,
  },
  copyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  copyHintText: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: '600',
  },
  linkBox: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  linkLabel: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  linkValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 28,
    backgroundColor: '#0b1730',
    borderWidth: 1,
    borderColor: 'rgba(0,123,255,0.45)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  toastText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  historyCard: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: colors.blue,
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(0, 20, 48, 0.85)',
  },
  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  historyEvent: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 12,
  },
  progressCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  progressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  progressPct: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.blue,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 0,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  refreshText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  tableHead: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },
  tableRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  th: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  td: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
  },
  tdCode: {
    color: colors.blue,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  colWhen: { flex: 1.15 },
  colCode: { flex: 1.25 },
  colHolder: { flex: 0.9 },
  colTicket: { flex: 1.1 },
  pageHint: {
    color: colors.muted,
    fontSize: 12,
    flex: 1,
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  pagerBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  pagerBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pagerBtnOff: {
    opacity: 0.45,
  },
  moneyBox: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 16,
  },
  moneyLabel: {
    color: colors.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  money: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    marginTop: 6,
  },
  financeBoot: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderLeftWidth: 4,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  channelTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
    gap: 8,
  },
  channelTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  channelCount: {
    color: colors.muted,
    fontSize: 12,
  },
  channelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  channelCell: {
    width: '47%',
  },
  channelLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  channelValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  channelMuted: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  posBreakdown: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  posLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  kpi: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: 12,
  },
  kpiCoupon: {
    backgroundColor: 'rgba(61,220,151,0.10)',
    borderColor: 'rgba(61,220,151,0.28)',
  },
  kpiNet: {
    backgroundColor: 'rgba(0,123,255,0.12)',
    borderColor: 'rgba(0,123,255,0.35)',
  },
  kpiLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  kpiValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  kpiHint: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 4,
  },
  kpiCouponText: {
    color: colors.success,
  },
  kpiCouponHint: {
    color: 'rgba(61,220,151,0.78)',
  },
  kpiNetText: {
    color: colors.blue,
  },
  purchase: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  purchaseCoupon: {
    backgroundColor: 'rgba(61,220,151,0.08)',
    borderColor: 'rgba(61,220,151,0.22)',
  },
  purchaseCancelled: {
    backgroundColor: 'rgba(255,92,122,0.08)',
    borderColor: 'rgba(255,92,122,0.22)',
  },
  purchaseTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  purchaseLeft: {
    flex: 1,
    minWidth: 0,
  },
  purchaseRight: {
    alignItems: 'flex-end',
  },
  purchaseCode: {
    color: colors.blue,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    fontWeight: '700',
  },
  purchaseMeta: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 3,
  },
  purchaseNet: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  purchaseBuyer: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  purchaseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  purchasePay: {
    color: colors.muted,
    fontSize: 12,
    flex: 1,
  },
  purchaseCourtesy: {
    color: '#c084fc',
  },
  purchaseStrike: {
    textDecorationLine: 'line-through',
  },
  purchaseFees: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  purchaseFee: {
    color: colors.muted,
    fontSize: 11,
  },
});
