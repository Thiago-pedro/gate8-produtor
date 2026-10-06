import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Loader } from '@/components/Loader';
import { colors } from '@/constants/theme';
import { fetchTicketTransfers, type TicketTransfer } from '@/lib/ticket-delivery';

function shortCode(value: string) {
  const code = value.trim();
  return code ? code.slice(0, 8) : '—';
}

export function TransferenciasSection({ eventId, nonce }: { eventId: string; nonce: number }) {
  const [rows, setRows] = useState<TicketTransfer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await fetchTicketTransfers(eventId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar as transferências.');
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load, nonce]);

  if (!rows && !error) {
    return (
      <View style={styles.boot}>
        <Loader size={148} />
      </View>
    );
  }
  if (error && !rows) return <Text style={styles.empty}>{error}</Text>;
  if (!rows || rows.length === 0) return <Text style={styles.empty}>Nenhuma transferência neste evento.</Text>;

  return (
    <View style={styles.block}>
      {rows.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.title}>{item.ticketName || 'Ingresso'}</Text>
          <Text style={styles.line}>
            {item.fromName || '—'}
            {item.fromEmail ? ` · ${item.fromEmail}` : ''}
          </Text>
          <Text style={styles.line}>
            para {item.toName || '—'}
            {item.toEmail ? ` · ${item.toEmail}` : ''}
          </Text>
          {item.oldCode || item.newCode ? (
            <Text style={styles.meta} numberOfLines={1}>
              {shortCode(item.oldCode)} → {shortCode(item.newCode)}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  boot: { minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  block: { gap: 10 },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: 12,
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  title: { color: colors.text, fontWeight: '700' },
  line: { color: colors.text, fontSize: 13 },
  meta: { color: colors.muted, fontSize: 12 },
  empty: { color: colors.muted, textAlign: 'center', paddingVertical: 20 },
});
