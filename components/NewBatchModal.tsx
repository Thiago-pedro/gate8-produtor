import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Loader } from '@/components/Loader';
import { colors } from '@/constants/theme';
import {
  BATCH_GENDERS,
  asBatchGender,
  batchTicketName,
  createTicketBatch,
  updateTicketBatch,
  type BatchGender,
  type EventBatch,
} from '@/lib/events';
import { formatEventDateTime } from '@/lib/format';

function parseMoney(value: string) {
  const n = Number(value.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

function toDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function DateTimeField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: Date | null;
  onChange: (next: Date | null) => void;
}) {
  const [open, setOpen] = useState<'date' | 'time' | 'datetime' | null>(null);
  const [draft, setDraft] = useState(new Date());

  function start() {
    const next = value ?? new Date();
    setDraft(next);
    setOpen(Platform.OS === 'ios' ? 'datetime' : 'date');
  }

  function onPick(event: DateTimePickerEvent, selected?: Date) {
    if (event.type === 'dismissed') {
      setOpen(null);
      return;
    }
    const next = selected ?? draft;
    setDraft(next);
    if (Platform.OS === 'ios') return;
    if (open === 'date') {
      setOpen('time');
      return;
    }
    setOpen(null);
    onChange(next);
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={start} style={styles.dateBtn}>
        <Ionicons name="calendar-outline" size={16} color={colors.blue} />
        <Text style={[styles.dateText, !value && styles.placeholder]}>
          {value ? formatEventDateTime(value.toISOString()) : 'Selecione data e hora'}
        </Text>
        {value ? (
          <Pressable
            onPress={() => onChange(null)}
            hitSlop={8}
            style={styles.clearDate}
          >
            <Ionicons name="close-circle" size={16} color={colors.muted} />
          </Pressable>
        ) : null}
      </Pressable>
      <Text style={styles.hint}>{hint}</Text>
      {open ? (
        <View>
          <DateTimePicker
            value={draft}
            mode={open}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            is24Hour
            onChange={onPick}
          />
          {Platform.OS === 'ios' ? (
            <Pressable
              onPress={() => {
                onChange(draft);
                setOpen(null);
              }}
              style={styles.dateOk}
            >
              <Text style={styles.dateOkText}>Confirmar</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function NewBatchModal({
  visible,
  eventId,
  batches,
  batch,
  onClose,
  onSaved,
}: {
  visible: boolean;
  eventId: string;
  batches: EventBatch[];
  batch: EventBatch | null;
  onClose: () => void;
  onSaved: (created: boolean) => void;
}) {
  const editing = Boolean(batch);
  const sectors = useMemo(
    () => [...new Set(batches.map((item) => item.sector).filter((item): item is string => Boolean(item)))],
    [batches]
  );
  const [sector, setSector] = useState('');
  const [label, setLabel] = useState('');
  const [gender, setGender] = useState<BatchGender>('unisex');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [validFrom, setValidFrom] = useState<Date | null>(null);
  const [validUntil, setValidUntil] = useState<Date | null>(null);
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setSector(batch?.sector ?? '');
    setLabel(batch ? batchTicketName(batch) : '');
    setGender(asBatchGender(batch?.gender ?? null));
    setPrice(batch ? String(batch.price) : '');
    setQuantity(batch ? String(batch.quantity) : '');
    setValidFrom(toDate(batch?.valid_from ?? null));
    setValidUntil(toDate(batch?.valid_until ?? null));
    setActive(batch?.active !== false);
    setBusy(false);
    setError(null);
  }, [visible, batch]);

  async function submit() {
    setError(null);
    setBusy(true);
    const fields = {
      sector,
      label,
      gender,
      price: price.trim() ? parseMoney(price) : 0,
      quantity: quantity.trim() ? Math.floor(Number(quantity.replace(',', '.'))) : 0,
      validFrom: validFrom ? validFrom.toISOString() : null,
      validUntil: validUntil ? validUntil.toISOString() : null,
      active,
    };
    try {
      if (batch) {
        await updateTicketBatch(batch.id, fields);
      } else {
        await createTicketBatch({ eventId, ...fields });
      }
      onSaved(!batch);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : batch
            ? 'Não foi possível salvar o lote.'
            : 'Não foi possível criar o lote.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetTop}>
            <Text style={styles.title}>{editing ? 'Editar lote' : 'Novo lote'}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.form}
          >
            <View style={styles.field}>
              <Text style={styles.label}>Setor</Text>
              <TextInput
                value={sector}
                onChangeText={setSector}
                placeholder="Ex.: Frontstage - Open Bar Premium"
                placeholderTextColor="rgba(255,255,255,0.28)"
                style={styles.input}
              />
              {sectors.length > 0 ? (
                <View style={styles.chips}>
                  {sectors.map((item) => (
                    <Pressable
                      key={item}
                      onPress={() => setSector(item)}
                      style={[styles.chip, sector === item && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, sector === item && styles.chipTextOn]}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.row}>
              <View style={[styles.field, styles.half]}>
                <Text style={styles.label}>Nome do ingresso</Text>
                <TextInput
                  value={label}
                  onChangeText={setLabel}
                  placeholder="Ex.: Lote 1 / Entrada"
                  placeholderTextColor="rgba(255,255,255,0.28)"
                  style={styles.input}
                />
              </View>
              <View style={[styles.field, styles.half]}>
                <Text style={styles.label}>Tipo</Text>
                <View style={styles.genderWrap}>
                  {BATCH_GENDERS.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => setGender(item.id)}
                      style={[styles.genderBtn, gender === item.id && styles.genderBtnOn]}
                    >
                      <Text style={[styles.genderText, gender === item.id && styles.genderTextOn]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.field, styles.half]}>
                <Text style={styles.label}>Preço (R$)</Text>
                <TextInput
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                  placeholder="0,00"
                  placeholderTextColor="rgba(255,255,255,0.28)"
                  style={styles.input}
                />
              </View>
              <View style={[styles.field, styles.half]}>
                <Text style={styles.label}>Quantidade</Text>
                <TextInput
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor="rgba(255,255,255,0.28)"
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.field, styles.half]}>
                <DateTimeField
                  label="Início da venda (opcional)"
                  hint="Se preenchido, o lote só fica à venda a partir desta data."
                  value={validFrom}
                  onChange={setValidFrom}
                />
              </View>
              <View style={[styles.field, styles.half]}>
                <DateTimeField
                  label="Validade do lote (opcional)"
                  hint="Data/hora em que o lote encerra automaticamente."
                  value={validUntil}
                  onChange={setValidUntil}
                />
              </View>
            </View>

            <View style={styles.toggleBox}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>Lote ativo</Text>
                <Text style={styles.hint}>Desative para ocultar do checkout sem apagar o lote.</Text>
              </View>
              <Switch
                value={active}
                onValueChange={setActive}
                trackColor={{ false: 'rgba(255,255,255,0.18)', true: colors.blue }}
                thumbColor="#ffffff"
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable onPress={() => void submit()} disabled={busy} style={styles.submit}>
              {busy ? (
                <Loader size={22} color={colors.loginText} />
              ) : (
                <Text style={styles.submitText}>{editing ? 'Salvar' : 'Criar'}</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingBottom: 18,
  },
  sheetTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  form: {
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 12,
  },
  field: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  half: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    color: 'rgba(255,255,255,0.80)',
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
  },
  placeholder: {
    color: 'rgba(255,255,255,0.40)',
  },
  hint: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 11,
    lineHeight: 16,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipOn: {
    backgroundColor: 'rgba(0,123,255,0.22)',
    borderColor: colors.blue,
  },
  chipText: {
    color: colors.muted,
    fontSize: 11,
  },
  chipTextOn: {
    color: colors.text,
    fontWeight: '600',
  },
  genderWrap: {
    gap: 6,
  },
  genderBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  genderBtnOn: {
    borderColor: colors.blue,
    backgroundColor: 'rgba(0,123,255,0.18)',
  },
  genderText: {
    color: colors.muted,
    fontSize: 12,
  },
  genderTextOn: {
    color: colors.text,
    fontWeight: '600',
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  dateText: {
    color: colors.text,
    fontSize: 13,
    flex: 1,
  },
  clearDate: {
    paddingLeft: 4,
  },
  dateOk: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  dateOkText: {
    color: colors.blue,
    fontWeight: '700',
    fontSize: 13,
  },
  toggleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toggleCopy: {
    flex: 1,
    minWidth: 0,
  },
  toggleTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  submit: {
    backgroundColor: colors.blue,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitText: {
    color: colors.loginText,
    fontSize: 16,
    fontWeight: '700',
  },
});
