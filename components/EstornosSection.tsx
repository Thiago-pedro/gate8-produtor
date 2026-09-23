import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Loader } from '@/components/Loader';
import { colors } from '@/constants/theme';
import { formatBRL, formatDateTime } from '@/lib/format';
import {
  executeRefund,
  fetchRefundReport,
  refundMethodLabel,
  searchRefunds,
  type RefundReport,
  type RefundSearchHit,
} from '@/lib/refunds';

export function EstornosSection({
  eventId,
  nonce,
  onToast,
}: {
  eventId: string;
  nonce: number;
  onToast: (message: string) => void;
}) {
  const [data, setData] = useState<RefundReport | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<RefundSearchHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [confirm, setConfirm] = useState<RefundSearchHit | null>(null);
  const [refundingKey, setRefundingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setData(await fetchRefundReport(eventId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os estornos.');
    } finally {
      setBusy(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load, nonce]);

  async function onSearch() {
    const value = query.trim();
    if (value.length < 2) {
      onToast('Digite ao menos 2 caracteres.');
      return;
    }
    setSearching(true);
    setSearched(false);
    try {
      setHits(await searchRefunds(eventId, value));
      setSearched(true);
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : 'Não foi possível buscar a compra.');
    } finally {
      setSearching(false);
    }
  }

  async function onConfirmRefund() {
    if (!confirm) return;
    const hit = confirm;
    setConfirm(null);
    setRefundingKey(hit.key);
    try {
      const result = await executeRefund(eventId, hit);
      onToast(result.message);
      setHits(await searchRefunds(eventId, query.trim()));
      setData(await fetchRefundReport(eventId));
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : 'Não foi possível estornar.');
    } finally {
      setRefundingKey(null);
    }
  }

  if (busy && !data) {
    return (
      <View style={styles.boot}>
        <Loader size={148} />
      </View>
    );
  }

  if (error && !data) return <Text style={styles.empty}>{error}</Text>;

  return (
    <View style={styles.block}>
      <Text style={styles.title}>Estornar compra</Text>
      <Text style={styles.copy}>
        Busque pelo nome do comprador ou pelo codigo da compra (ex.: GT8-ABC123).
      </Text>

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Nome do comprador ou GT8-..."
          placeholderTextColor="rgba(255,255,255,0.32)"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => void onSearch()}
          style={styles.searchInput}
        />
        <Pressable
          onPress={() => void onSearch()}
          disabled={searching}
          style={({ pressed }) => [styles.searchBtn, pressed && styles.pressed]}
        >
          {searching ? (
            <Loader size={22} />
          ) : (
            <Ionicons name="search" size={18} color={colors.loginText} />
          )}
        </Pressable>
      </View>

      {searched && hits.length === 0 ? (
        <Text style={styles.empty}>Nenhuma compra encontrada.</Text>
      ) : null}

      {hits.map((hit) => {
        const refunding = refundingKey === hit.key;
        const done = hit.activeTickets === 0;
        return (
          <View key={hit.key} style={styles.hit}>
            <View style={styles.hitInfo}>
              <Text style={styles.buyer}>{hit.buyer}</Text>
              <Text style={styles.meta}>
                {hit.kind === 'purchase'
                  ? `${hit.purchaseCode ? `${hit.purchaseCode} · ` : ''}${formatBRL(hit.totalAmount)} · ${
                      hit.method ? refundMethodLabel(hit.method) : '—'
                    } · ${hit.viaPagarme ? 'via Pagar.me' : 'manual'}`
                  : `Sem compra (avulso) · ${hit.method ? refundMethodLabel(hit.method) : 'cortesia'}`}
              </Text>
              <Text style={styles.meta}>
                {hit.activeTickets} ativo(s) / {hit.ticketCount} total · {formatDateTime(hit.createdAt) || '—'}
              </Text>
            </View>
            <Pressable
              onPress={() => setConfirm(hit)}
              disabled={refunding || done}
              style={({ pressed }) => [
                styles.refundBtn,
                (refunding || done) && styles.refundBtnOff,
                pressed && !refunding && !done && styles.pressed,
              ]}
            >
              <Text style={styles.refundText}>{refunding ? '...' : done ? 'Já cancelado' : 'Estornar'}</Text>
            </Pressable>
          </View>
        );
      })}

      {data ? (
        <>
          <View style={styles.kpis}>
            <View style={[styles.kpi, styles.kpiDanger]}>
              <Text style={styles.kpiLabel}>Total estornado</Text>
              <Text style={styles.kpiValue}>{formatBRL(data.totalAmount)}</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>Ingressos cancelados</Text>
              <Text style={styles.kpiValue}>{String(data.totalTickets)}</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>Operações</Text>
              <Text style={styles.kpiValue}>{String(data.count)}</Text>
            </View>
          </View>

          {data.refunds.length === 0 ? (
            <Text style={styles.empty}>Nenhum estorno realizado neste evento ainda.</Text>
          ) : (
            data.refunds.map((item, index) => (
              <View key={`${item.purchaseCode ?? item.buyer}-${index}`} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.buyer}>{item.buyer}</Text>
                    {item.purchaseCode ? <Text style={styles.code}>{item.purchaseCode}</Text> : null}
                  </View>
                  <Text style={styles.amount}>{formatBRL(item.amount)}</Text>
                </View>
                <Text style={styles.meta}>
                  {formatDateTime(item.createdAt) || '—'} · {refundMethodLabel(item.method)}
                </Text>
                <Text style={styles.meta}>
                  {item.ticketCount} ingresso{item.ticketCount === 1 ? '' : 's'}
                  {item.freedTables > 0 ? ` · ${item.freedTables} mesa(s)` : ''}
                </Text>
                {item.gatewayMessage ? <Text style={styles.gateway}>{item.gatewayMessage}</Text> : null}
              </View>
            ))
          )}
        </>
      ) : null}

      <Modal visible={!!confirm} transparent animationType="fade" onRequestClose={() => setConfirm(null)}>
        <Pressable style={styles.modalBg} onPress={() => setConfirm(null)}>
          <Pressable style={styles.modal} onPress={() => undefined}>
            <Text style={styles.modalTitle}>Confirmar estorno</Text>
            <Text style={styles.modalText}>
              {confirm?.kind === 'purchase'
                ? `Estornar compra ${confirm.purchaseCode}? Esta ação não pode ser desfeita.`
                : `Cancelar ${confirm?.activeTickets} ingresso(s) de ${confirm?.buyer}? Esta ação não pode ser desfeita.`}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setConfirm(null)}
                style={({ pressed }) => [styles.modalCancel, pressed && styles.pressed]}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => void onConfirmRefund()}
                style={({ pressed }) => [styles.modalOk, pressed && styles.pressed]}
              >
                <Text style={styles.modalOkText}>Confirmar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  boot: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  block: {
    marginTop: 18,
    gap: 10,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  copy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: colors.text,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: 12,
  },
  hitInfo: {
    flex: 1,
    minWidth: 0,
  },
  refundBtn: {
    backgroundColor: colors.danger,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refundBtnOff: {
    opacity: 0.45,
  },
  refundText: {
    color: colors.loginText,
    fontSize: 12,
    fontWeight: '700',
  },
  kpis: {
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
  kpiDanger: {
    backgroundColor: 'rgba(255,92,122,0.10)',
    borderColor: 'rgba(255,92,122,0.28)',
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
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: 14,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'flex-start',
  },
  cardInfo: {
    flex: 1,
  },
  buyer: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  code: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  amount: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  gateway: {
    color: 'rgba(255,92,122,0.9)',
    fontSize: 11,
    marginTop: 6,
  },
  empty: {
    color: colors.muted,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.7,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    width: '100%',
    backgroundColor: '#050d1f',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    padding: 18,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  modalText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 18,
  },
  modalCancel: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: colors.text,
    fontWeight: '600',
  },
  modalOk: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOkText: {
    color: colors.loginText,
    fontWeight: '700',
  },
});
