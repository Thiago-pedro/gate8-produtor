import { StyleSheet, Text, View } from 'react-native';

import { Loader } from '@/components/Loader';
import { colors } from '@/constants/theme';
import type { EventBoletos } from '@/lib/boletos';
import { formatBRL, formatDateTime } from '@/lib/format';

export function BoletosSection({
  report,
  busy,
  error,
}: {
  report: EventBoletos | null;
  busy: boolean;
  error: string | null;
}) {
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

  if (!report || report.rows.length === 0) {
    return (
      <View style={styles.block}>
        <Text style={styles.empty}>Nenhuma venda por boleto neste evento.</Text>
        <Text style={styles.hint}>
          Quando houver boletos emitidos, o bruto, o valor compensado, a taxa e o líquido aparecem aqui.
        </Text>
      </View>
    );
  }

  const { totals } = report;

  return (
    <View style={styles.block}>
      <View style={styles.grid}>
        <Summary label="Bruto" value={formatBRL(totals.gross)} />
        <Summary label="Compensado" value={formatBRL(totals.paid)} tone="paid" />
        <Summary label="Taxa Gate8" value={formatBRL(totals.fees)} />
        <Summary label="Líquido" value={formatBRL(totals.net)} tone="net" />
      </View>
      <Text style={styles.hint}>
        {totals.generated} {totals.generated === 1 ? 'boleto emitido' : 'boletos emitidos'}. A taxa de
        emissão entra mesmo com o boleto ainda pendente, então o líquido pode ficar negativo até a
        compensação.
      </Text>

      {[...report.rows]
        .sort((left, right) => {
          const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
          const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
          return rightTime - leftTime;
        })
        .map((row) => {
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
    </View>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'paid' | 'net';
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
});
