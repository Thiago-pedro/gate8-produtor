import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Loader } from '@/components/Loader';
import { colors } from '@/constants/theme';
import {
  fetchEventBalance,
  type BalanceResponse,
  type BalanceTimelineItem,
} from '@/lib/balance';
import { formatBRL } from '@/lib/format';

function formatDay(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatStamp(iso: string) {
  if (!iso) return '';
  const day = formatDay(iso);
  const time = new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${day}, ${time}`;
}

function formatReceiptDay(day: string) {
  const [year, month, date] = day.split('-');
  if (!year || !month || !date) return day;
  return `${date}/${month}/${year}`;
}

function signed(value: number) {
  const formatted = formatBRL(Math.abs(value));
  return value < 0 ? `- ${formatted}` : `+ ${formatted}`;
}

function Kpi({
  icon,
  label,
  value,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tone?: 'net' | 'available' | 'fees';
}) {
  return (
    <View style={[styles.kpi, tone === 'net' && styles.kpiNet, tone === 'available' && styles.kpiAvailable]}>
      <View style={styles.kpiHead}>
        <Ionicons
          name={icon}
          size={14}
          color={tone === 'available' || tone === 'net' ? colors.blue : colors.muted}
        />
        <Text style={[styles.kpiLabel, (tone === 'net' || tone === 'available') && styles.kpiLabelOn]}>
          {label}
        </Text>
      </View>
      <Text
        style={[
          styles.kpiValue,
          tone === 'fees' && styles.kpiFees,
          (tone === 'net' || tone === 'available') && styles.kpiValueOn,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function TimelineCard({ item }: { item: BalanceTimelineItem }) {
  if (item.type === 'boleto_issue' || item.type === 'boleto_paid') {
    const issued = item.type === 'boleto_issue';
    const countLabel = issued
      ? `${item.count} boleto${item.count === 1 ? '' : 's'}${
          item.ticketCount > 0
            ? ` · ${item.ticketCount} ingresso${item.ticketCount === 1 ? '' : 's'}`
            : ''
        }`
      : `${item.count} boleto${item.count === 1 ? '' : 's'} compensado${item.count === 1 ? '' : 's'}`;
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.cardInfo}>
            <Text style={issued ? styles.issueTitle : styles.paidTitle}>
              {issued ? 'Venda por boleto · Emitidos' : 'Compensação de boleto'}
            </Text>
            <Text style={styles.meta}>{formatStamp(item.occurredAt)}</Text>
            <Text style={styles.meta}>
              {item.purchaseCode} · {item.buyer}
            </Text>
            <Text style={styles.meta}>{countLabel}</Text>
            <Text style={styles.balance}>Saldo acumulado: {formatBRL(item.balanceAfter)}</Text>
          </View>
          <Text style={item.net < 0 ? styles.minus : styles.plus}>{signed(item.net)}</Text>
        </View>
        <Text style={styles.side}>
          {issued
            ? `Bruto emitido ${formatBRL(item.gross)} · Taxa Gate8 - ${formatBRL(item.fees)}`
            : `Valor compensado ${formatBRL(item.gross)}`}
        </Text>
      </View>
    );
  }

  if (item.type === 'sales') {
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.cardInfo}>
            <Text style={styles.salesTitle}>Recebimentos de {formatReceiptDay(item.day)}</Text>
            <Text style={styles.meta}>
              {item.salesCount} venda{item.salesCount === 1 ? '' : 's'} · {item.ticketCount} ingresso
              {item.ticketCount === 1 ? '' : 's'}
            </Text>
            <Text style={styles.balance}>Saldo acumulado: {formatBRL(item.balanceAfter)}</Text>
          </View>
          <Text style={styles.plus}>{signed(item.net)}</Text>
        </View>
        <Text style={styles.side}>
          Bruto {formatBRL(item.gross)} · Taxas – {formatBRL(item.fees)}
        </Text>
      </View>
    );
  }

  if (item.type === 'withdrawal') {
    const paid = item.status === 'paid';
    const title = paid ? 'Retirada paga' : item.status === 'rejected' ? 'Retirada rejeitada' : 'Retirada pendente';
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.cardInfo}>
            <Text style={[styles.withdrawTitle, !paid && styles.mutedTitle]}>{title}</Text>
            <Text style={styles.meta}>{formatStamp(item.occurredAt)}</Text>
            {item.notes ? <Text style={styles.meta}>{item.notes}</Text> : null}
            <Text style={styles.balance}>Saldo acumulado: {formatBRL(item.balanceAfter)}</Text>
          </View>
          <Text style={[styles.minus, !paid && styles.mutedTitle]}>{signed(-Math.abs(item.amount))}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardInfo}>
          <Text style={styles.refundTitle}>Estorno</Text>
          <Text style={styles.meta}>{formatStamp(item.occurredAt)}</Text>
          {item.buyerName || item.purchaseCode ? (
            <Text style={styles.meta}>
              {[item.buyerName, item.purchaseCode].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          <Text style={styles.meta}>
            {item.ticketCount} ingresso{item.ticketCount === 1 ? '' : 's'}
          </Text>
          <Text style={styles.balance}>Saldo acumulado: {formatBRL(item.balanceAfter)}</Text>
        </View>
        <Text style={styles.minus}>{signed(-Math.abs(item.amount))}</Text>
      </View>
    </View>
  );
}

function pdfHtml(data: BalanceResponse) {
  const rows = data.timeline
    .map((item) => {
      if (item.type === 'sales') {
        return `<tr><td>Recebimentos ${formatReceiptDay(item.day)}</td><td>${item.salesCount} vendas · ${item.ticketCount} ingressos</td><td>${formatBRL(item.net)}</td><td>${formatBRL(item.balanceAfter)}</td></tr>`;
      }
      if (item.type === 'boleto_issue') {
        return `<tr><td>Emissão de boleto</td><td>${item.buyer} · ${item.count} boletos · taxa ${formatBRL(item.fees)}</td><td>${formatBRL(item.net)}</td><td>${formatBRL(item.balanceAfter)}</td></tr>`;
      }
      if (item.type === 'boleto_paid') {
        return `<tr><td>Compensação de boleto</td><td>${item.buyer} · ${item.purchaseCode}</td><td>${formatBRL(item.net)}</td><td>${formatBRL(item.balanceAfter)}</td></tr>`;
      }
      if (item.type === 'withdrawal') {
        return `<tr><td>Retirada ${item.status}</td><td>${item.notes ?? formatStamp(item.occurredAt)}</td><td>- ${formatBRL(item.amount)}</td><td>${formatBRL(item.balanceAfter)}</td></tr>`;
      }
      return `<tr><td>Estorno</td><td>${item.buyerName ?? item.purchaseCode ?? formatStamp(item.occurredAt)}</td><td>- ${formatBRL(item.amount)}</td><td>${formatBRL(item.balanceAfter)}</td></tr>`;
    })
    .join('');
  const company = data.company;
  return `<html><body style="font-family:sans-serif;padding:24px;color:#111">
    <h1>Balanço do evento</h1>
    <p>${data.eventName} · da criação do evento até hoje</p>
    ${company ? `<p>${[company.registeredName || company.name, company.document, company.email, company.phone, company.address].filter(Boolean).join(' · ')}</p>` : ''}
    <p>${formatDay(data.startsAt)} até ${formatDay(data.endsAt)}</p>
    <p>Receita bruta ${formatBRL(data.summary.gross)} · Taxas ${formatBRL(data.summary.fees)} · Líquido ${formatBRL(data.summary.net)} · Disponível ${formatBRL(data.summary.available)}</p>
    <p>Retirado: ${formatBRL(data.summary.withdrawnPaid)} · Estornado: ${formatBRL(data.summary.refunded)}</p>
    <table border="1" cellpadding="6" cellspacing="0" width="100%">
      <tr><th>Movimento</th><th>Detalhe</th><th>Valor</th><th>Saldo</th></tr>
      ${rows}
    </table>
  </body></html>`;
}

export function BalancoSection({
  eventId,
  nonce,
  onToast,
}: {
  eventId: string;
  nonce: number;
  onToast: (message: string) => void;
}) {
  const [data, setData] = useState<BalanceResponse | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setData(await fetchEventBalance(eventId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar o balanço.');
    } finally {
      setBusy(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load, nonce]);

  async function downloadPdf() {
    if (!data || printing) return;
    setPrinting(true);
    try {
      const file = await Print.printToFileAsync({ html: pdfHtml(data) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Balanço ${data.eventName}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        onToast('PDF gerado neste aparelho.');
      }
    } catch {
      onToast('Não foi possível gerar o PDF.');
    } finally {
      setPrinting(false);
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
  if (!data) return <Text style={styles.empty}>Não foi possível carregar o balanço.</Text>;

  const records = data.timeline.length;

  return (
    <View style={styles.block}>
      <View style={styles.titleRow}>
        <Ionicons name="pulse-outline" size={18} color={colors.blue} />
        <Text style={styles.title}>Balanço do evento</Text>
      </View>
      <Text style={styles.subtitle}>{data.eventName} · da criação do evento até hoje</Text>

      <View style={styles.kpis}>
        <Kpi icon="cash-outline" label="Receita bruta" value={formatBRL(data.summary.gross)} />
        <Kpi icon="document-text-outline" label="Taxas" value={`– ${formatBRL(data.summary.fees)}`} tone="fees" />
        <Kpi icon="pulse-outline" label="Total líquido" value={formatBRL(data.summary.net)} tone="net" />
        <Kpi icon="wallet-outline" label="Disponível" value={formatBRL(data.summary.available)} tone="available" />
      </View>

      <View style={styles.range}>
        <Text style={styles.rangeText}>
          {formatDay(data.startsAt)} até {formatDay(data.endsAt)}
        </Text>
        <Text style={styles.rangeText}>
          Retirado: {formatBRL(data.summary.withdrawnPaid)} · Estornado: {formatBRL(data.summary.refunded)}
        </Text>
      </View>

      <View style={styles.timelineHead}>
        <View>
          <Text style={styles.timelineTitle}>Linha do tempo</Text>
          <Text style={styles.timelineHint}>
            Recebimentos, emissão e compensação de boletos, retiradas e estornos em ordem cronológica.
          </Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{records} registros</Text>
        </View>
      </View>

      <View style={styles.rail}>
        <View style={styles.createdCard}>
          <Text style={styles.createdWhen}>{formatStamp(data.startsAt)}</Text>
          <Text style={styles.createdTitle}>Evento criado</Text>
        </View>

        {data.timeline.map((item) => (
          <View key={item.id} style={styles.row}>
            <View
              style={[
                styles.dot,
                (item.type === 'withdrawal' || item.type === 'refund') && styles.dotGold,
                item.type === 'boleto_issue' && styles.dotIssue,
                item.type === 'boleto_paid' && styles.dotPaid,
              ]}
            />
            <TimelineCard item={item} />
          </View>
        ))}

        <View style={styles.todayCard}>
          <View style={styles.availableRow}>
            <View style={styles.availableIcon}>
              <Ionicons name="wallet" size={18} color="#7EBEFF" />
            </View>
            <View style={styles.availableCopy}>
              <Text style={styles.availableLabel} numberOfLines={1}>
                Saldo disponível
              </Text>
              <Text style={styles.availableValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
                {formatBRL(data.summary.available)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <Pressable
        onPress={() => void downloadPdf()}
        disabled={printing}
        style={({ pressed }) => [styles.pdfBtn, pressed && styles.pressed]}
      >
        <Ionicons name="download-outline" size={16} color={colors.loginText} />
        <Text style={styles.pdfText}>{printing ? 'Gerando...' : 'Baixar PDF'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  boot: { minHeight: 180, alignItems: 'center', justifyContent: 'center' },
  block: { marginTop: 18, gap: 12 },
  empty: { color: colors.muted, fontSize: 13, marginTop: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: -4 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: {
    width: '48%',
    flexGrow: 1,
    minWidth: 140,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 12,
    gap: 8,
  },
  kpiNet: { borderColor: 'rgba(0,123,255,0.45)' },
  kpiAvailable: { borderColor: colors.blue, backgroundColor: 'rgba(0,123,255,0.10)' },
  kpiHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kpiLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  kpiLabelOn: { color: colors.blue },
  kpiValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  kpiValueOn: { color: colors.blue },
  kpiFees: { color: colors.muted },
  range: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    gap: 4,
  },
  rangeText: { color: colors.muted, fontSize: 12 },
  timelineHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' },
  timelineTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  timelineHint: { color: colors.muted, fontSize: 12, marginTop: 4, maxWidth: 220 },
  countPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  rail: { gap: 10, borderLeftWidth: 2, borderLeftColor: colors.blue, paddingLeft: 12, marginLeft: 6 },
  createdCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 12,
    gap: 4,
  },
  createdWhen: { color: colors.muted, fontSize: 12 },
  createdTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  row: { position: 'relative' },
  dot: {
    position: 'absolute',
    left: -17,
    top: 18,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.blue,
  },
  dotGold: { backgroundColor: colors.warning },
  dotIssue: { backgroundColor: '#7EBEFF' },
  dotPaid: { backgroundColor: colors.success },
  issueTitle: { color: '#7EBEFF', fontSize: 14, fontWeight: '700' },
  paidTitle: { color: colors.success, fontSize: 14, fontWeight: '700' },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 12,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  cardInfo: { flex: 1, minWidth: 0, gap: 3 },
  salesTitle: { color: colors.blue, fontSize: 14, fontWeight: '700' },
  withdrawTitle: { color: colors.warning, fontSize: 14, fontWeight: '700' },
  refundTitle: { color: colors.danger, fontSize: 14, fontWeight: '700' },
  mutedTitle: { color: colors.muted },
  meta: { color: colors.muted, fontSize: 12 },
  balance: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 2 },
  plus: { color: colors.success, fontWeight: '800', fontSize: 14 },
  minus: { color: colors.warning, fontWeight: '800', fontSize: 14 },
  side: { color: colors.muted, fontSize: 11, textAlign: 'right' },
  todayCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,123,255,0.35)',
    backgroundColor: 'rgba(0,123,255,0.12)',
    padding: 12,
  },
  availableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  availableIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 70, 180, 0.55)',
  },
  availableCopy: {
    flexShrink: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  availableLabel: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  availableValue: {
    color: '#3B9BFF',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 1,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  pdfBtn: {
    marginTop: 4,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.blue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pdfText: { color: colors.loginText, fontWeight: '700', fontSize: 15 },
  pressed: { opacity: 0.86 },
});
