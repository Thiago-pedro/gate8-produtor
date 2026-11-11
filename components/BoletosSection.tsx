import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Loader } from '@/components/Loader';
import { colors } from '@/constants/theme';
import {
  clientDeletablePurchases,
  deleteEventClientBoletos,
  fetchBoletoCancellationCount,
  fetchEventBoletoClients,
  type BoletoClientGroup,
  type EventBoletos,
} from '@/lib/boletos';
import { formatBRL, formatDateTime } from '@/lib/format';

const PAGE_SIZE = 6;

export function BoletosSection({
  eventId,
  canWrite,
  report,
  busy,
  error,
  onToast,
  onChanged,
}: {
  eventId: string;
  canWrite: boolean;
  report: EventBoletos | null;
  busy: boolean;
  error: string | null;
  onToast: (message: string) => void;
  onChanged?: () => void;
}) {
  const [page, setPage] = useState(1);
  const [cancelled, setCancelled] = useState<number | null>(null);
  const [cancelledError, setCancelledError] = useState(false);
  const [clients, setClients] = useState<BoletoClientGroup[]>([]);
  const [clientsBusy, setClientsBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    clientId: string;
    name: string;
    purchaseIds: string[];
    boletoCount: number;
    totalCents: number;
  } | null>(null);

  const loadExtras = useCallback(async () => {
    setClientsBusy(true);
    setCancelledError(false);
    const [countResult, clientsResult] = await Promise.allSettled([
      fetchBoletoCancellationCount(eventId),
      fetchEventBoletoClients(eventId),
    ]);
    if (countResult.status === 'fulfilled') setCancelled(countResult.value);
    else {
      setCancelled(null);
      setCancelledError(true);
    }
    if (clientsResult.status === 'fulfilled') setClients(clientsResult.value);
    else setClients([]);
    setClientsBusy(false);
  }, [eventId]);

  useEffect(() => {
    setPage(1);
    void loadExtras();
  }, [report, loadExtras]);

  const ordered = useMemo(
    () =>
      [...(report?.rows ?? [])].sort((left, right) => {
        const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
        const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
        return rightTime - leftTime;
      }),
    [report]
  );

  async function runDelete() {
    if (!confirm) return;
    const target = confirm;
    setConfirm(null);
    setDeletingId(target.clientId);
    try {
      const result = await deleteEventClientBoletos(eventId, target.purchaseIds);
      if (result.providerFailures.length) {
        onToast(
          `Boletos excluídos na Gate8. Não consegui cancelar no adquirente: ${result.providerFailures.join(', ')}. Cancele manualmente.`
        );
      } else {
        onToast('Boletos excluídos na Gate8 e cancelados no adquirente.');
      }
      await loadExtras();
      onChanged?.();
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : 'Não foi possível excluir os boletos.');
    } finally {
      setDeletingId(null);
    }
  }

  if (busy && !report) {
    return (
      <View style={styles.boot}>
        <Loader size={148} />
      </View>
    );
  }

  if (error && !report) {
    return <Text style={styles.empty}>{error}</Text>;
  }

  const totals = report?.totals;
  const pages = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = ordered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const emptySales = !report || report.rows.length === 0;

  return (
    <View style={styles.block}>
      {totals ? (
        <View style={styles.grid}>
          <Summary label="Bruto" value={formatBRL(totals.gross)} />
          <Summary label="Compensado" value={formatBRL(totals.paid)} tone="paid" />
          <Summary label="Taxa Gate8" value={formatBRL(totals.fees)} />
          <Summary label="Líquido" value={formatBRL(totals.net)} tone="net" />
          <Summary
            label="Boletos cancelados"
            value={cancelledError ? '—' : cancelled == null ? '…' : String(cancelled)}
            hint="Desde 11/11/2026"
          />
        </View>
      ) : (
        <View style={styles.grid}>
          <Summary
            label="Boletos cancelados"
            value={cancelledError ? '—' : cancelled == null ? '…' : String(cancelled)}
            hint="Desde 11/11/2026"
          />
        </View>
      )}

      {emptySales ? (
        <>
          <Text style={styles.empty}>Nenhuma venda por boleto neste evento.</Text>
          <Text style={styles.hint}>
            Quando houver boletos emitidos, o bruto, o valor compensado, a taxa e o líquido aparecem aqui.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.hint}>
            {totals?.generated ?? 0} {(totals?.generated ?? 0) === 1 ? 'boleto emitido' : 'boletos emitidos'}.
            A taxa de emissão entra mesmo com o boleto ainda pendente, então o líquido pode ficar negativo até a
            compensação.
          </Text>

          {visible.map((row) => {
            const code = (row.id || row.intentId).slice(0, 8).toUpperCase();
            return (
              <View key={row.id || row.intentId} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.cardCopy}>
                    <Text style={styles.buyer} numberOfLines={2}>
                      {row.buyer}
                    </Text>
                    <Text style={styles.meta}>
                      Boleto {code}
                      {row.createdAt ? ` · ${formatDateTime(row.createdAt)}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.net, row.net < 0 && styles.netNegative]}>{formatBRL(row.net)}</Text>
                </View>
                <Text style={styles.counts}>
                  {row.generated} {row.generated === 1 ? 'boleto emitido' : 'boletos emitidos'} · {row.paidCount}{' '}
                  {row.paidCount === 1 ? 'pago' : 'pagos'}
                  {row.ticketCount > 0
                    ? ` · ${row.ticketCount} ${row.ticketCount === 1 ? 'ingresso' : 'ingressos'}`
                    : ''}
                </Text>
                <View style={styles.metrics}>
                  <Metric label="Bruto" value={formatBRL(row.gross)} />
                  <Metric label="Compensado" value={formatBRL(row.paid)} />
                  <Metric label="Taxa" value={formatBRL(row.fees)} hint={row.feeDescription} />
                </View>
              </View>
            );
          })}
          {pages > 1 ? (
            <View style={styles.pager}>
              <Pressable
                onPress={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage <= 1}
                style={[styles.pagerBtn, currentPage <= 1 && styles.off]}
              >
                <Ionicons name="chevron-back" size={18} color={colors.text} />
              </Pressable>
              <Text style={styles.pagerText}>
                Página {currentPage} de {pages}
              </Text>
              <Pressable
                onPress={() => setPage((current) => Math.min(pages, current + 1))}
                disabled={currentPage >= pages}
                style={[styles.pagerBtn, currentPage >= pages && styles.off]}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.text} />
              </Pressable>
            </View>
          ) : null}
        </>
      )}

      {canWrite ? (
        <View style={styles.manage}>
          <Text style={styles.manageTitle}>Excluir boletos</Text>
          <Text style={styles.hint}>
            Só o dono pode excluir. Compras com parcela paga ou já materializadas ficam bloqueadas.
          </Text>
          {clientsBusy && clients.length === 0 ? (
            <View style={styles.inlineBusy}>
              <ActivityIndicator color={colors.loginText} />
            </View>
          ) : clients.length === 0 ? (
            <Text style={styles.empty}>Nenhum cliente com boleto para gerenciar.</Text>
          ) : (
            clients.map((group) => {
              const deletable = clientDeletablePurchases(group);
              const installments = group.purchases.flatMap((purchase) => purchase.installments);
              const paid = installments.filter((item) => item.status === 'paid' || item.paidAt).length;
              const total = installments.reduce((sum, item) => sum + item.amountCents, 0) / 100;
              const blocked = deletable.length === 0;
              const deleting = deletingId === group.clientId;
              return (
                <View key={group.clientId} style={styles.card}>
                  <View style={styles.cardHead}>
                    <View style={styles.cardCopy}>
                      <Text style={styles.buyer} numberOfLines={2}>
                        {group.name}
                      </Text>
                      {group.email ? <Text style={styles.meta}>{group.email}</Text> : null}
                      <Text style={styles.counts}>
                        {installments.length} boletos · {paid} compensados · {formatBRL(total)}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    disabled={blocked || deleting}
                    onPress={() => {
                      if (blocked) {
                        onToast('Há boleto compensado; não é possível excluir.');
                        return;
                      }
                      const open = deletable.flatMap((purchase) => purchase.installments).filter(
                        (item) => item.status !== 'canceled'
                      );
                      setConfirm({
                        clientId: group.clientId,
                        name: group.name,
                        purchaseIds: deletable.map((purchase) => purchase.id),
                        boletoCount: open.length,
                        totalCents: open.reduce((sum, item) => sum + item.amountCents, 0),
                      });
                    }}
                    style={[styles.deleteBtn, (blocked || deleting) && styles.off]}
                  >
                    {deleting ? (
                      <ActivityIndicator color={colors.loginText} />
                    ) : (
                      <>
                        <Ionicons name="trash-outline" size={16} color={colors.loginText} />
                        <Text style={styles.deleteText}>Excluir boletos</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
      ) : null}

      <Modal visible={!!confirm} transparent animationType="fade" onRequestClose={() => setConfirm(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Excluir boletos</Text>
            <Text style={styles.modalBody}>
              Excluir {confirm?.boletoCount ?? 0} boleto(s) de {confirm?.name}? Total{' '}
              {formatBRL((confirm?.totalCents ?? 0) / 100)}. Esta ação cancela no adquirente quando possível.
            </Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setConfirm(null)} style={styles.modalGhost}>
                <Text style={styles.modalGhostText}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={() => void runDelete()} style={styles.modalDanger}>
                <Text style={styles.modalDangerText}>Excluir</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Summary({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: 'paid' | 'net';
  hint?: string;
}) {
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        style={[styles.summaryValue, tone === 'paid' && styles.paidValue, tone === 'net' && styles.netValue]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>
      {hint ? <Text style={styles.summaryHint}>{hint}</Text> : null}
    </View>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string | null }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {hint ? <Text style={styles.metricHint}>{hint}</Text> : null}
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
    gap: 12,
  },
  empty: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  hint: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 13,
    lineHeight: 19,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summary: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    gap: 4,
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  summaryHint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  paidValue: {
    color: colors.success,
  },
  netValue: {
    color: '#3B9BFF',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    gap: 8,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardCopy: {
    flex: 1,
    gap: 2,
  },
  buyer: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12,
  },
  net: {
    color: '#3B9BFF',
    fontSize: 16,
    fontWeight: '800',
  },
  netNegative: {
    color: '#7EBEFF',
  },
  counts: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
  },
  metrics: {
    flexDirection: 'row',
    gap: 8,
  },
  metric: {
    flex: 1,
    gap: 2,
  },
  metricLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  metricHint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
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
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagerText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  off: {
    opacity: 0.4,
  },
  manage: {
    gap: 10,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  manageTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  inlineBusy: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  deleteBtn: {
    marginTop: 4,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(220, 60, 60, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
  },
  deleteText: {
    color: colors.loginText,
    fontSize: 14,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    backgroundColor: '#12141A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 18,
    gap: 12,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  modalBody: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    lineHeight: 21,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  modalGhost: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalGhostText: {
    color: colors.muted,
    fontWeight: '700',
  },
  modalDanger: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(220, 60, 60, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDangerText: {
    color: colors.loginText,
    fontWeight: '800',
  },
});
