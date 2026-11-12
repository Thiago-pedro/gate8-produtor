import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import { colors } from '@/constants/theme';
import type { SalesPulse } from '@/lib/sales-pulse';

type Props = {
  pulse: SalesPulse;
};

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricIcon}>
        <Ionicons name={icon} size={15} color="#7EBEFF" />
      </View>
      <View style={styles.metricCopy}>
        <Text style={styles.metricLabel} numberOfLines={2}>
          {label}
        </Text>
        <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
          {value.toLocaleString('pt-BR')}
        </Text>
      </View>
    </View>
  );
}

function SalesChart({ daily }: { daily: SalesPulse['daily'] }) {
  const { width: screenW } = useWindowDimensions();
  const width = Math.max(280, screenW - 64);
  const height = 200;
  const padL = 28;
  const padR = 12;
  const padT = 28;
  const padB = 36;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxY = useMemo(() => {
    const peak = Math.max(0, ...daily.map((point) => point.count));
    if (peak <= 0) return 10;
    const step = peak <= 40 ? 10 : peak <= 80 ? 20 : peak <= 160 ? 40 : 50;
    return Math.ceil(peak / step) * step;
  }, [daily]);

  const points = daily.map((point, index) => {
    const x =
      daily.length <= 1
        ? padL + plotW / 2
        : padL + (index / (daily.length - 1)) * plotW;
    const y = padT + plotH - (point.count / maxY) * plotH;
    return { ...point, x, y };
  });

  const line =
    points.length === 0
      ? ''
      : points
          .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
          .join(' ');
  const area =
    points.length === 0
      ? ''
      : `${line} L ${points[points.length - 1]!.x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${points[0]!.x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(maxY * ratio));

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>Ingressos vendidos por dia · últimos 7 dias</Text>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.blue} stopOpacity="0.35" />
            <Stop offset="1" stopColor={colors.blue} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>
        {ticks.map((tick) => {
          const y = padT + plotH - (tick / maxY) * plotH;
          return (
            <SvgText
              key={`y-${tick}`}
              x={padL - 8}
              y={y + 3}
              fill="rgba(255,255,255,0.35)"
              fontSize="10"
              textAnchor="end"
            >
              {tick}
            </SvgText>
          );
        })}
        {area ? <Path d={area} fill="url(#salesFill)" /> : null}
        {line ? (
          <Path d={line} stroke={colors.blue} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ) : null}
        {points.map((point) => (
          <Circle
            key={point.key}
            cx={point.x}
            cy={point.y}
            r={4.5}
            fill="#FFFFFF"
            stroke={colors.blue}
            strokeWidth={2}
          />
        ))}
        {points.map((point) => (
          <SvgText
            key={`v-${point.key}`}
            x={point.x}
            y={point.y - 10}
            fill="#FFFFFF"
            fontSize="11"
            fontWeight="700"
            textAnchor="middle"
          >
            {point.count}
          </SvgText>
        ))}
        {points.map((point) => (
          <SvgText
            key={`l-${point.key}`}
            x={point.x}
            y={height - 10}
            fill="rgba(255,255,255,0.45)"
            fontSize="9"
            textAnchor="middle"
          >
            {point.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

/** Painel fixo acima das abas: Vendidos hoje · Últimos 7 dias · Validados + gráfico. */
export function EventSalesPulse({ pulse }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.metrics}>
        <MetricCard icon="calendar-outline" label="Vendidos hoje" value={pulse.soldToday} />
        <MetricCard icon="trending-up-outline" label="Últimos 7 dias" value={pulse.soldLast7} />
        <MetricCard icon="checkmark-circle-outline" label="Validados" value={pulse.validated} />
      </View>
      <SalesChart daily={pulse.daily} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16,
    gap: 10,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
  },
  metric: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  metricIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,123,255,0.18)',
  },
  metricCopy: {
    flex: 1,
    minWidth: 0,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '600',
  },
  metricValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  chartCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 16,
    paddingTop: 14,
    paddingHorizontal: 8,
    paddingBottom: 8,
    overflow: 'hidden',
  },
  chartTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 8,
    marginBottom: 4,
  },
});
