import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Loader } from '@/components/Loader';
import { colors } from '@/constants/theme';
import { fetchTicketTransfers, type TicketTransfer } from '@/lib/ticket-delivery';

const PAGE_SIZE = 8;

function shortCode(value: string) {
  const code = value.trim();
  return code ? code.slice(0, 8) : '—';
}

function formatTransferAt(value: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const time = date.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${day} · ${time}`;
}

export function TransferenciasSection({ eventId, nonce }: { eventId: string; nonce: number }) {
  const [rows, setRows] = useState<TicketTransfer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await fetchTicketTransfers(eventId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar as transferências.');
    }
  }, [eventId]);

  useEffect(() => {
    setPage(1);
    void load();
  }, [load, nonce]);

  const pages = Math.max(1, Math.ceil((rows?.length ?? 0) / PAGE_SIZE));

  useEffect(() => {
    setPage((current) => Math.min(current, pages));
  }, [pages]);

  const currentPage = Math.min(page, pages);
  const visible = (rows ?? []).slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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
      {visible.map((item) => {
        const when = formatTransferAt(item.createdAt);
        return (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.title}>{item.ticketName || 'Ingresso'}</Text>
            {when ? <Text style={styles.when}>{when}</Text> : null}
          </View>
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
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: { color: colors.text, fontWeight: '700', flex: 1 },
  when: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  line: { color: colors.text, fontSize: 13 },
  meta: { color: colors.muted, fontSize: 12 },
  empty: { color: colors.muted, textAlign: 'center', paddingVertical: 20 },
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
  pagerText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  off: { opacity: 0.4 },
});
