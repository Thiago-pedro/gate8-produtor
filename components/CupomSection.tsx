import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Loader } from '@/components/Loader';
import { colors } from '@/constants/theme';
import {
  EMPTY_COUPON,
  fetchEventCoupon,
  saveManagedCoupon,
  validateCoupon,
  type EventCoupon,
  type EventCouponDraft,
} from '@/lib/create-event';
import { formatBRL } from '@/lib/format';

function draftFromCoupon(coupon: EventCoupon | null): EventCouponDraft {
  if (!coupon) return EMPTY_COUPON;
  return {
    active: coupon.active,
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: String(coupon.discountValue).replace('.', ','),
  };
}

function discountLabel(coupon: EventCoupon) {
  if (coupon.discountType === 'percent') return `${coupon.discountValue}%`;
  return formatBRL(coupon.discountValue);
}

export function CupomSection({
  eventId,
  nonce,
  onToast,
}: {
  eventId: string;
  nonce: number;
  onToast: (message: string) => void;
}) {
  const [saved, setSaved] = useState<EventCoupon | null>(null);
  const [draft, setDraft] = useState<EventCouponDraft>(EMPTY_COUPON);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const onToastRef = useRef(onToast);
  onToastRef.current = onToast;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const coupon = await fetchEventCoupon(eventId);
      setSaved(coupon);
      setDraft(draftFromCoupon(coupon));
    } catch {
      setSaved(null);
      setDraft(EMPTY_COUPON);
      onToastRef.current('Não foi possível carregar o cupom.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load, nonce]);

  async function save() {
    const error = validateCoupon(draft);
    if (error) {
      onToast(error);
      return;
    }
    setSaving(true);
    try {
      await saveManagedCoupon(eventId, draft);
      const coupon = await fetchEventCoupon(eventId);
      setSaved(coupon);
      setDraft(draftFromCoupon(coupon));
      onToast(draft.active ? 'Cupom salvo e ativo.' : 'Cupom desativado.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      onToast(
        message === 'percent_out_of_range'
          ? 'O desconto em porcentagem não pode passar de 100%.'
          : 'Não foi possível salvar o cupom.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.boot}>
        <Loader size={120} />
      </View>
    );
  }

  return (
    <View style={styles.block}>
      <Text style={styles.title}>Cupom de desconto</Text>
      <Text style={styles.copy}>
        Quando o cupom está ativo, o campo para digitar o código aparece no carrinho deste evento e o
        desconto entra logo abaixo do subtotal.
      </Text>

      {saved ? (
        <View style={styles.status}>
          <View style={styles.statusTop}>
            <Text style={styles.code}>{saved.code}</Text>
            <Text style={[styles.badge, saved.active ? styles.badgeOn : styles.badgeOff]}>
              {saved.active ? 'Ativo no carrinho' : 'Desativado'}
            </Text>
          </View>
          <Text style={styles.meta}>
            {saved.discountType === 'percent' ? 'Porcentagem' : 'Valor fixo'} · {discountLabel(saved)}
          </Text>
        </View>
      ) : (
        <Text style={styles.empty}>Este evento ainda não tem cupom.</Text>
      )}

      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.label}>Cupom ativo</Text>
            <Text style={styles.hint}>Desligue para encerrar o desconto no carrinho.</Text>
          </View>
          <Switch
            value={draft.active}
            onValueChange={(value) => setDraft((current) => ({ ...current, active: value }))}
            trackColor={{ true: colors.blue }}
            disabled={saving}
          />
        </View>

        {draft.active ? (
          <>
            <Text style={styles.label}>Código</Text>
            <TextInput
              value={draft.code}
              onChangeText={(value) =>
                setDraft((current) => ({ ...current, code: value.toUpperCase().replace(/\s/g, '') }))
              }
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="EX: ARRAIA10"
              placeholderTextColor="rgba(255,255,255,0.32)"
              style={styles.input}
              editable={!saving}
            />

            <Text style={styles.label}>Tipo de desconto</Text>
            <View style={styles.chips}>
              <Pressable
                onPress={() => setDraft((current) => ({ ...current, discountType: 'percent' }))}
                style={[styles.chip, draft.discountType === 'percent' && styles.chipOn]}
                disabled={saving}
              >
                <Text style={[styles.chipText, draft.discountType === 'percent' && styles.chipTextOn]}>
                  Porcentagem (%)
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setDraft((current) => ({ ...current, discountType: 'fixed' }))}
                style={[styles.chip, draft.discountType === 'fixed' && styles.chipOn]}
                disabled={saving}
              >
                <Text style={[styles.chipText, draft.discountType === 'fixed' && styles.chipTextOn]}>
                  Valor (R$)
                </Text>
              </Pressable>
            </View>

            <Text style={styles.label}>
              {draft.discountType === 'percent' ? 'Desconto (%)' : 'Desconto (R$)'}
            </Text>
            <TextInput
              value={draft.discountValue}
              onChangeText={(value) =>
                setDraft((current) => ({ ...current, discountValue: value.replace(/[^\d.,]/g, '') }))
              }
              keyboardType="decimal-pad"
              placeholder={draft.discountType === 'percent' ? '10' : '20,00'}
              placeholderTextColor="rgba(255,255,255,0.32)"
              style={styles.input}
              editable={!saving}
            />
          </>
        ) : (
          <Text style={styles.hint}>
            {saved
              ? 'Salvar assim encerra o cupom. O código continua guardado para você reativar depois.'
              : 'Ligue o cupom para definir o código e o desconto.'}
          </Text>
        )}

        <Pressable
          onPress={() => void save()}
          disabled={saving}
          style={({ pressed }) => [styles.save, (pressed || saving) && styles.pressed]}
        >
          {saving ? (
            <Loader size={22} />
          ) : (
            <>
              <Ionicons name="pricetag-outline" size={16} color={colors.text} />
              <Text style={styles.saveText}>Salvar cupom</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 18, gap: 10 },
  boot: { minHeight: 160, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  copy: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  empty: { color: colors.muted, fontSize: 13 },
  status: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,123,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 14,
    gap: 6,
  },
  statusTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  code: { color: colors.text, fontSize: 18, fontWeight: '800', letterSpacing: 0.6, flex: 1 },
  badge: {
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '700',
  },
  badgeOn: { color: colors.success, backgroundColor: 'rgba(61,220,151,0.14)' },
  badgeOff: { color: colors.muted, backgroundColor: 'rgba(255,255,255,0.08)' },
  meta: { color: colors.muted, fontSize: 13 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  label: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: colors.text,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  chipOn: { borderColor: colors.blue, backgroundColor: 'rgba(0,123,255,0.18)' },
  chipText: { color: 'rgba(255,255,255,0.62)', fontWeight: '700', fontSize: 13 },
  chipTextOn: { color: colors.text },
  save: {
    marginTop: 6,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.blue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  pressed: { opacity: 0.75 },
});
