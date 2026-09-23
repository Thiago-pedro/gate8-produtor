import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Loader } from '@/components/Loader';
import { colors } from '@/constants/theme';
import { formatBRL, formatDateTime } from '@/lib/format';
import {
  fetchWithdrawalSummary,
  maskWithdrawAmount,
  parseWithdrawAmount,
  requestWithdrawal,
  withdrawalStatusLabel,
  type WithdrawalSummary,
} from '@/lib/withdrawals';

function Line({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={[styles.lineValue, muted && styles.lineMuted]}>{value}</Text>
    </View>
  );
}

export function RetiradasSection({
  eventId,
  nonce,
  onToast,
}: {
  eventId: string;
  nonce: number;
  onToast: (message: string) => void;
}) {
  const [data, setData] = useState<WithdrawalSummary | null>(null);
  const [busy, setBusy] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setData(await fetchWithdrawalSummary(eventId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar as retiradas.');
    } finally {
      setBusy(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load, nonce]);

  if (busy && !data) {
    return (
      <View style={styles.boot}>
        <Loader size={148} />
      </View>
    );
  }

  if (error && !data) return <Text style={styles.empty}>{error}</Text>;
  if (!data) return <Text style={styles.empty}>Nenhuma retirada neste evento.</Text>;

  const parsed = parseWithdrawAmount(amount);
  const amountOk = Number.isFinite(parsed) && parsed > 0 && parsed <= data.available + 0.001;
  const canRequest = data.available > 0.01 && !data.hasPending && amountOk && !sending;
  const summary = data;

  async function submit() {
    if (!canRequest) return;
    setSending(true);
    try {
      await requestWithdrawal({ eventId, amount: parsed, notes, summary });
      setAmount('');
      setNotes('');
      onToast('Pedido de retirada enviado');
      setData(await fetchWithdrawalSummary(eventId));
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : 'Não foi possível enviar o pedido.');
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.block}>
      <View style={styles.card}>
        <Line label="Receita bruta" value={formatBRL(data.gross)} />
        <Line label="Taxa de serviço Gate8" value={`- ${formatBRL(data.serviceFees)}`} muted />
        <Line label="Taxa do banco / Pagar.me" value={`- ${formatBRL(data.bankFees)}`} muted />
        <View style={styles.netRow}>
          <Text style={styles.netLabel}>Total líquido</Text>
          <Text style={styles.netValue}>{formatBRL(data.net)}</Text>
        </View>
        {data.withdrawnPaid > 0 ? (
          <Line label="Valor retirado" value={`- ${formatBRL(data.withdrawnPaid)}`} muted />
        ) : null}
        <Line label="Disponível para retirada" value={formatBRL(Math.max(0, data.available))} />
      </View>

      {data.available > 0.01 && !data.hasPending ? (
        <View style={styles.form}>
          <Text style={styles.fieldLabel}>Valor a retirar</Text>
          <View style={styles.amountRow}>
            <TextInput
              value={amount}
              onChangeText={(value) => setAmount(maskWithdrawAmount(value))}
              placeholder="0,00"
              placeholderTextColor="rgba(255,255,255,0.32)"
              keyboardType="number-pad"
              style={styles.input}
            />
            <Pressable
              onPress={() =>
                setAmount(
                  data.available.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                )
              }
              style={({ pressed }) => [styles.maxBtn, pressed && styles.pressed]}
            >
              <Text style={styles.maxText}>Máx</Text>
            </Pressable>
          </View>
          {amount && !amountOk ? (
            <Text style={styles.warn}>
              Informe um valor entre {formatBRL(0.01)} e {formatBRL(data.available)}.
            </Text>
          ) : null}
          <Text style={styles.fieldLabel}>Motivo da retirada (opcional)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Ex: pagamento de fornecedor, reembolso..."
            placeholderTextColor="rgba(255,255,255,0.32)"
            multiline
            style={[styles.input, styles.notes]}
          />
        </View>
      ) : null}

      {data.hasPending ? (
        <Text style={styles.pendingHint}>Já existe um pedido pendente neste evento.</Text>
      ) : null}

      {data.requests.length > 0 ? (
        <View style={styles.history}>
          <Text style={styles.historyTitle}>Histórico</Text>
          {data.requests.map((item) => (
            <View key={item.id} style={styles.request}>
              <View style={styles.requestTop}>
                <View style={styles.requestInfo}>
                  <Text style={styles.requestValue}>{formatBRL(item.amountNet)}</Text>
                  <Text style={styles.requestWhen}>{formatDateTime(item.createdAt) || '—'}</Text>
                </View>
                <Text
                  style={[
                    styles.badge,
                    item.status === 'paid'
                      ? styles.badgePaid
                      : item.status === 'rejected'
                        ? styles.badgeRejected
                        : styles.badgePending,
                  ]}
                >
                  {withdrawalStatusLabel(item.status)}
                </Text>
              </View>
              {item.notes ? <Text style={styles.requestNotes}>Motivo: {item.notes}</Text> : null}
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>Nenhuma retirada registrada.</Text>
      )}

      {data.available > 0.01 ? (
        <Pressable
          onPress={() => void submit()}
          disabled={!canRequest}
          style={({ pressed }) => [
            styles.submit,
            !canRequest && styles.submitOff,
            pressed && canRequest && styles.pressed,
          ]}
        >
          <Text style={styles.submitText}>{data.hasPending ? 'Pedido pendente' : 'Pedido de retirada'}</Text>
        </Pressable>
      ) : null}
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
    gap: 12,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  lineLabel: {
    color: colors.muted,
    fontSize: 13,
    flex: 1,
  },
  lineValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  lineMuted: {
    color: colors.muted,
    fontWeight: '600',
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
    paddingTop: 10,
  },
  netLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  netValue: {
    color: colors.blue,
    fontSize: 16,
    fontWeight: '800',
  },
  form: {
    gap: 8,
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  amountRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: colors.text,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  notes: {
    minHeight: 72,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  maxBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  maxText: {
    color: colors.text,
    fontWeight: '700',
  },
  warn: {
    color: colors.danger,
    fontSize: 12,
  },
  pendingHint: {
    color: colors.warning,
    fontSize: 13,
  },
  history: {
    gap: 8,
  },
  historyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  request: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: 12,
  },
  requestTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'center',
  },
  requestInfo: {
    flex: 1,
  },
  requestValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  requestWhen: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  requestNotes: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  badge: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  badgePaid: {
    color: '#4ade80',
    backgroundColor: 'rgba(74,222,128,0.15)',
  },
  badgeRejected: {
    color: colors.danger,
    backgroundColor: 'rgba(255,92,122,0.15)',
  },
  badgePending: {
    color: colors.warning,
    backgroundColor: 'rgba(245,197,66,0.15)',
  },
  submit: {
    backgroundColor: colors.blue,
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitOff: {
    opacity: 0.45,
  },
  submitText: {
    color: colors.loginText,
    fontSize: 14,
    fontWeight: '700',
  },
  empty: {
    color: colors.muted,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.7,
  },
});
