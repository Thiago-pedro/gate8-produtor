import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Loader } from '@/components/Loader';
import { colors } from '@/constants/theme';
import { fetchBoletoCancellationCount, type EventBoletos } from '@/lib/boletos';
import { formatBRL } from '@/lib/format';

export function BoletosSection({
  eventId,
  report,
  busy,
  error,
}: {
  eventId: string;
  report: EventBoletos | null;
  busy: boolean;
  error: string | null;
}) {
  const [cancelled, setCancelled] = useState<number | null>(null);
  const [cancelledError, setCancelledError] = useState(false);

  const loadCancelled = useCallback(async () => {
    setCancelledError(false);
    try {
      setCancelled(await fetchBoletoCancellationCount(eventId));
    } catch {
      setCancelled(null);
      setCancelledError(true);
    }
  }, [eventId]);

  useEffect(() => {
    void loadCancelled();
  }, [report, loadCancelled]);

  const counts = useMemo(() => {
    const rows = report?.rows ?? [];
    let compensatedCount = 0;
    let pendingCount = 0;
    for (const row of rows) {
      const paid = Math.max(0, Math.min(row.paidCount, row.generated));
      compensatedCount += paid;
      pendingCount += Math.max(0, row.generated - paid);
    }
    const paidAmount = report?.totals.paid ?? 0;
    const pendingAmount = Math.max(0, (report?.totals.gross ?? 0) - paidAmount);
    return { compensatedCount, pendingCount, paidAmount, pendingAmount };
  }, [report]);

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

  return (
    <View style={styles.block}>
      <View style={styles.grid}>
        <Summary label="Bruto" value={totals ? formatBRL(totals.gross) : 'R$ 0,00'} />
        <Summary label="Compensado" value={totals ? formatBRL(totals.paid) : 'R$ 0,00'} tone="paid" />
        <Summary label="Taxa Gate8" value={totals ? formatBRL(totals.fees) : 'R$ 0,00'} />
        <Summary label="Líquido" value={totals ? formatBRL(totals.net) : 'R$ 0,00'} tone="net" />
        <Summary
          label="Boletos cancelados"
          value={cancelledError ? '—' : cancelled == null ? '…' : String(cancelled)}
        />
        <Summary label="Total emitidos" value={String(totals?.generated ?? 0)} />
        <CountMoney
          label="Compensados"
          count={counts.compensatedCount}
          amount={counts.paidAmount}
        />
        <CountMoney
          label="A compensar"
          count={counts.pendingCount}
          amount={counts.pendingAmount}
        />
      </View>

      <Text style={styles.hint}>Detalhamento e exclusão de boletos ficam no site.</Text>
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

function CountMoney({ label, count, amount }: { label: string; count: number; amount: number }) {
  return (
    <View style={styles.summary}>
      <Text style={styles.countLabel}>{label}</Text>
      <Text style={styles.countValue}>{count}</Text>
      <Text style={styles.countMoney} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {formatBRL(amount)}
      </Text>
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
  countLabel: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 13,
    fontWeight: '600',
  },
  countValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  countMoney: {
    color: '#3B9BFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
