import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Image,
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { Loader } from '@/components/Loader';
import { SiteFooter } from '@/components/SiteFooter';
import { TermosSection } from '@/components/TermosSection';
import { colors } from '@/constants/theme';
import {
  EMPTY_COUPON,
  composeLocation,
  createProducerEvent,
  geocodeAddress,
  lookupCep,
  maskCep,
  saveEventCoupon,
  uploadEventImage,
  validateCoupon,
  type EventCouponDraft,
} from '@/lib/create-event';
import { formatEventDateTime } from '@/lib/format';

const STEPS = ['Identidade', 'Data & Local', 'Regras & Aceite'] as const;
const MAX_BYTES = 5 * 1024 * 1024;

function DateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | null;
  onChange: (next: Date) => void;
}) {
  const [open, setOpen] = useState<'date' | 'time' | 'datetime' | null>(null);
  const [draft, setDraft] = useState(value ?? new Date());

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
      </Pressable>
      {open ? (
        <View>
          <DateTimePicker
            value={draft}
            mode={open}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            is24Hour
            minimumDate={new Date()}
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
              <Text style={styles.link}>Confirmar</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

async function pickImage(kind: 'banner' | 'map') {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Permita o acesso às fotos para enviar a imagem.');
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: kind === 'banner',
    aspect: kind === 'banner' ? [16, 9] : undefined,
    quality: 0.85,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  if (asset.fileSize && asset.fileSize > MAX_BYTES) throw new Error('Imagem muito grande. Máx 5MB.');
  return {
    uri: asset.uri,
    type: asset.mimeType || (kind === 'map' ? 'image/jpeg' : 'image/jpeg'),
  };
}

export default function NovoEventoScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cepBusy, setCepBusy] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [banner, setBanner] = useState<{ uri: string; type: string } | null>(null);
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [capacity, setCapacity] = useState('');
  const [venueName, setVenueName] = useState('');
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [map, setMap] = useState<{ uri: string; type: string } | null>(null);
  const [hasTables, setHasTables] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [accepted, setAccepted] = useState(false);
  const [coupon, setCoupon] = useState<EventCouponDraft>(EMPTY_COUPON);

  function toast(message: string) {
    setError(message);
  }

  async function onCep(value: string) {
    const next = maskCep(value);
    setCep(next);
    if (next.replace(/\D/g, '').length !== 8) return;
    setCepBusy(true);
    try {
      const found = await lookupCep(next);
      if (!found) return;
      setStreet((current) => found.street || current);
      setNeighborhood((current) => found.neighborhood || current);
      setCity((current) => found.city || current);
      setState((current) => found.state || current);
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Falha ao buscar o CEP');
    } finally {
      setCepBusy(false);
    }
  }

  function nextStep() {
    if (step === 1) {
      if (!name.trim()) return toast('Informe o nome do evento.');
      setError(null);
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!eventDate) return toast('Selecione a data e hora do evento.');
      setError(null);
      setStep(3);
    }
  }

  async function onSubmit() {
    if (!eventDate) return toast('Selecione a data e hora do evento.');
    if (!accepted) return toast('Você precisa aceitar os Termos de Uso da Gate8.');
    const couponError = validateCoupon(coupon);
    if (couponError) return toast(couponError);
    setBusy(true);
    setError(null);
    try {
      let bannerUrl: string | null = null;
      let mapUrl: string | null = null;
      if (banner) bannerUrl = await uploadEventImage(banner.uri, banner.type);
      if (map) mapUrl = await uploadEventImage(map.uri, map.type, 'maps');
      const location = composeLocation({
        venueName,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        cep,
      });
      let latitude: number | null = null;
      let longitude: number | null = null;
      if (location) {
        try {
          const geo = await geocodeAddress(location);
          latitude = geo.latitude;
          longitude = geo.longitude;
        } catch {
          /* site also ignores geocode failure */
        }
      }
      const id = await createProducerEvent({
        name,
        description,
        eventDate,
        location: location || null,
        latitude,
        longitude,
        capacity: capacity ? Number(capacity) : null,
        bannerUrl,
        mapUrl,
        status,
        hasTables,
        isHidden,
      });
      if (coupon.active) {
        try {
          await saveEventCoupon(id, coupon);
        } catch {
          toast('Evento criado, mas o cupom não pôde ser salvo. Cadastre-o em Editar evento.');
        }
      }
      router.replace({ pathname: '/evento/[id]', params: { id } });
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Não foi possível criar o evento.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.back}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
            <Text style={styles.backText}>Voltar</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>Novo evento</Text>
        <Text style={styles.lead}>Configure os dados do evento e os setores/lotes de ingressos.</Text>

        <View style={styles.stepper}>
          {STEPS.map((label, index) => {
            const n = index + 1;
            const on = step === n;
            const done = step > n;
            return (
              <View key={label} style={styles.stepItem}>
                <View style={[styles.stepPill, (on || done) && styles.stepPillOn]}>
                  <View style={[styles.stepNum, (on || done) && styles.stepNumOn]}>
                    {done ? (
                      <Ionicons name="checkmark" size={12} color={colors.loginText} />
                    ) : (
                      <Text style={[styles.stepNumText, on && styles.stepNumTextOn]}>{n}</Text>
                    )}
                  </View>
                  <Text style={[styles.stepLabel, (on || done) && styles.stepLabelOn]} numberOfLines={1}>
                    {label}
                  </Text>
                </View>
                {index < STEPS.length - 1 ? <View style={[styles.stepLine, done && styles.stepLineOn]} /> : null}
              </View>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {step === 1 ? (
            <View style={styles.gap}>
              <Text style={styles.label}>Arte do evento</Text>
              {banner ? (
                <View style={styles.artBox}>
                  <Image source={{ uri: banner.uri }} style={styles.artImage} />
                  <Pressable onPress={() => setBanner(null)} style={styles.artRemove}>
                    <Ionicons name="close" size={16} color={colors.text} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    void pickImage('banner')
                      .then((file) => file && setBanner(file))
                      .catch((caught) => toast(caught instanceof Error ? caught.message : 'Falha ao escolher a arte'));
                  }}
                  style={styles.artEmpty}
                >
                  <Ionicons name="image-outline" size={28} color={colors.muted} />
                  <Text style={styles.artTitle}>Clique para enviar a arte</Text>
                  <Text style={styles.artHint}>
                    Wide (16:9) — PNG, JPG ou WEBP até 5MB. Imagens fora do formato ganham fundo desfocado automático.
                  </Text>
                </Pressable>
              )}
              <Text style={styles.label}>Nome do evento *</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Nome do evento"
                placeholderTextColor="rgba(255,255,255,0.32)"
                style={styles.input}
                maxLength={160}
              />
              <Text style={styles.label}>Descrição</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Fale sobre o evento: atrações, horários, regras, experiência..."
                placeholderTextColor="rgba(255,255,255,0.32)"
                style={[styles.input, styles.textarea]}
                multiline
                textAlignVertical="top"
              />
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.gap}>
              <DateTimeField label="Data e hora *" value={eventDate} onChange={setEventDate} />
              <Text style={styles.label}>Capacidade</Text>
              <TextInput
                value={capacity}
                onChangeText={(value) => setCapacity(value.replace(/\D/g, ''))}
                placeholder="Quantidade"
                placeholderTextColor="rgba(255,255,255,0.32)"
                keyboardType="number-pad"
                style={styles.input}
              />
              <View style={styles.card}>
                <Text style={styles.group}>Local do evento</Text>
                <Text style={styles.label}>CEP</Text>
                <View style={styles.row}>
                  <TextInput
                    value={cep}
                    onChangeText={(value) => void onCep(value)}
                    placeholder="00000-000"
                    placeholderTextColor="rgba(255,255,255,0.32)"
                    keyboardType="number-pad"
                    maxLength={9}
                    style={styles.input}
                  />
                  {cepBusy ? <Loader size={36} /> : null}
                </View>
                <Text style={styles.label}>Nome do local</Text>
                <TextInput
                  value={venueName}
                  onChangeText={setVenueName}
                  placeholder="Ex.: Barril 10"
                  placeholderTextColor="rgba(255,255,255,0.32)"
                  style={styles.input}
                />
                <Text style={styles.label}>Rua / Avenida</Text>
                <TextInput
                  value={street}
                  onChangeText={setStreet}
                  placeholderTextColor="rgba(255,255,255,0.32)"
                  style={styles.input}
                />
                <View style={styles.two}>
                  <View style={styles.flex}>
                    <Text style={styles.label}>Número</Text>
                    <TextInput
                      value={number}
                      onChangeText={setNumber}
                      placeholderTextColor="rgba(255,255,255,0.32)"
                      style={styles.input}
                    />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.label}>Complemento</Text>
                    <TextInput
                      value={complement}
                      onChangeText={setComplement}
                      placeholder="Sala, andar, referência..."
                      placeholderTextColor="rgba(255,255,255,0.32)"
                      style={styles.input}
                    />
                  </View>
                </View>
                <Text style={styles.label}>Bairro</Text>
                <TextInput
                  value={neighborhood}
                  onChangeText={setNeighborhood}
                  placeholderTextColor="rgba(255,255,255,0.32)"
                  style={styles.input}
                />
                <View style={styles.two}>
                  <View style={styles.flex}>
                    <Text style={styles.label}>Cidade</Text>
                    <TextInput
                      value={city}
                      onChangeText={setCity}
                      placeholderTextColor="rgba(255,255,255,0.32)"
                      style={styles.input}
                    />
                  </View>
                  <View style={{ width: 88 }}>
                    <Text style={styles.label}>Estado (UF)</Text>
                    <TextInput
                      value={state}
                      onChangeText={(value) => setState(value.toUpperCase().slice(0, 2))}
                      maxLength={2}
                      autoCapitalize="characters"
                      placeholderTextColor="rgba(255,255,255,0.32)"
                      style={styles.input}
                    />
                  </View>
                </View>
              </View>
              <View style={styles.card}>
                <Text style={styles.group}>Mapa do evento</Text>
                <Text style={styles.hint}>
                  Envie uma imagem (PNG ou JPG) do mapa do local. Pode ser em retrato ou paisagem. Máx 5MB.
                </Text>
                {map ? (
                  <View>
                    <Image source={{ uri: map.uri }} style={styles.mapImage} resizeMode="contain" />
                    <Pressable onPress={() => setMap(null)} style={styles.artRemove}>
                      <Ionicons name="close" size={16} color={colors.text} />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => {
                      void pickImage('map')
                        .then((file) => file && setMap(file))
                        .catch((caught) => toast(caught instanceof Error ? caught.message : 'Falha ao escolher o mapa'));
                    }}
                    style={styles.mapEmpty}
                  >
                    <Ionicons name="image-outline" size={22} color={colors.muted} />
                    <Text style={styles.artTitle}>Clique para enviar o mapa</Text>
                    <Text style={styles.artHint}>PNG ou JPG — retrato ou paisagem</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ) : null}

          {step === 3 ? (
            <View style={styles.gap}>
              <View style={styles.card}>
                <View style={styles.switchRow}>
                  <View style={styles.flex}>
                    <Text style={styles.group}>Evento com mesas</Text>
                    <Text style={styles.hint}>
                      Ative para vender mesas inteiras. Cada mesa vendida gera N convites no nome do comprador. Ingressos
                      avulsos continuam funcionando normalmente.
                    </Text>
                    {hasTables ? (
                      <Text style={styles.cyan}>Após criar o evento, configure o mapa de mesas na aba Mesas.</Text>
                    ) : null}
                  </View>
                  <Switch value={hasTables} onValueChange={setHasTables} trackColor={{ true: colors.blue }} />
                </View>
              </View>
              <View style={styles.card}>
                <View style={styles.switchRow}>
                  <View style={styles.flex}>
                    <Text style={styles.group}>Evento oculto (modo teste)</Text>
                    <Text style={styles.hint}>
                      Não aparece na home nem em listagens públicas. Continua acessível por link direto e pela
                      maquininha.
                    </Text>
                  </View>
                  <Switch value={isHidden} onValueChange={setIsHidden} trackColor={{ true: colors.blue }} />
                </View>
              </View>
              <View style={styles.card}>
                <View style={styles.switchRow}>
                  <View style={styles.flex}>
                    <Text style={styles.group}>Cupom de desconto</Text>
                    <Text style={styles.hint}>
                      Quando ativado, o campo para digitar o cupom aparece no carrinho deste evento.
                    </Text>
                  </View>
                  <Switch
                    value={coupon.active}
                    onValueChange={(value) => setCoupon((current) => ({ ...current, active: value }))}
                    trackColor={{ true: colors.blue }}
                  />
                </View>
                {coupon.active ? (
                  <>
                    <Text style={styles.label}>Código</Text>
                    <TextInput
                      value={coupon.code}
                      onChangeText={(value) => setCoupon((current) => ({ ...current, code: value.toUpperCase() }))}
                      autoCapitalize="characters"
                      placeholder="EX: ARRAIA10"
                      placeholderTextColor="rgba(255,255,255,0.32)"
                      style={styles.input}
                    />
                    <View style={styles.chips}>
                      <Pressable
                        onPress={() => setCoupon((current) => ({ ...current, discountType: 'percent' }))}
                        style={[styles.chip, coupon.discountType === 'percent' && styles.chipOn]}
                      >
                        <Text style={[styles.chipText, coupon.discountType === 'percent' && styles.chipTextOn]}>%</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setCoupon((current) => ({ ...current, discountType: 'fixed' }))}
                        style={[styles.chip, coupon.discountType === 'fixed' && styles.chipOn]}
                      >
                        <Text style={[styles.chipText, coupon.discountType === 'fixed' && styles.chipTextOn]}>R$</Text>
                      </Pressable>
                    </View>
                    <TextInput
                      value={coupon.discountValue}
                      onChangeText={(value) => setCoupon((current) => ({ ...current, discountValue: value }))}
                      keyboardType="decimal-pad"
                      placeholder={coupon.discountType === 'percent' ? 'Desconto (%)' : 'Desconto (R$)'}
                      placeholderTextColor="rgba(255,255,255,0.32)"
                      style={styles.input}
                    />
                  </>
                ) : null}
              </View>
              <Text style={styles.label}>Status</Text>
              <View style={styles.chips}>
                <Pressable onPress={() => setStatus('draft')} style={[styles.chip, status === 'draft' && styles.chipOn]}>
                  <Text style={[styles.chipText, status === 'draft' && styles.chipTextOn]}>Rascunho</Text>
                </Pressable>
                <Pressable
                  onPress={() => setStatus('published')}
                  style={[styles.chip, status === 'published' && styles.chipOn]}
                >
                  <Text style={[styles.chipText, status === 'published' && styles.chipTextOn]}>Publicado</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => setAccepted((value) => !value)}
                style={[styles.termsBox, accepted && styles.termsBoxOn]}
              >
                <View style={[styles.check, accepted && styles.checkOn]}>
                  {accepted ? <Ionicons name="checkmark" size={14} color={colors.loginText} /> : null}
                </View>
                <Text style={styles.termsText}>
                  Li e concordo com os{' '}
                  <Text
                    style={styles.link}
                    onPress={() => {
                      setTermsOpen(true);
                    }}
                  >
                    Termos de Uso e Condições Comerciais
                  </Text>{' '}
                  da Gate8.
                </Text>
              </Pressable>
            </View>
          ) : null}
          <SiteFooter />
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={() => setStep((value) => (value > 1 ? value - 1 : value))}
            disabled={step === 1 || busy}
            style={[styles.ghostBtn, (step === 1 || busy) && styles.off]}
          >
            <Ionicons name="chevron-back" size={16} color={colors.text} />
            <Text style={styles.ghostText}>Voltar</Text>
          </Pressable>
          {step < 3 ? (
            <Pressable onPress={nextStep} style={styles.primaryBtn}>
              <Text style={styles.primaryText}>Avançar</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.loginText} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void onSubmit()}
              disabled={!accepted || busy}
              style={[styles.primaryBtn, (!accepted || busy) && styles.off]}
            >
              {busy ? <Loader size={36} /> : <Text style={styles.primaryText}>{status === 'published' ? 'Publicar evento' : 'Criar evento'}</Text>}
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>

      <Modal visible={termsOpen} animationType="slide" onRequestClose={() => setTermsOpen(false)}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <Pressable onPress={() => setTermsOpen(false)} style={styles.back}>
            <Ionicons name="close" size={20} color={colors.text} />
            <Text style={styles.backText}>Fechar</Text>
          </Pressable>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
            <TermosSection nonce={0} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  topBar: { paddingHorizontal: 12, paddingTop: 4 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 4 },
  backText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', paddingHorizontal: 16 },
  lead: { color: colors.muted, fontSize: 13, paddingHorizontal: 16, marginTop: 4, marginBottom: 14 },
  stepper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 8 },
  stepItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  stepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexShrink: 1,
  },
  stepPillOn: { borderColor: 'rgba(0,123,255,0.6)', backgroundColor: 'rgba(0,123,255,0.15)' },
  stepNum: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumOn: { backgroundColor: colors.blue },
  stepNumText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  stepNumTextOn: { color: colors.loginText },
  stepLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', flexShrink: 1 },
  stepLabelOn: { color: colors.blue },
  stepLine: { flex: 0.35, height: 1, backgroundColor: 'rgba(255,255,255,0.10)', marginHorizontal: 4 },
  stepLineOn: { backgroundColor: 'rgba(0,123,255,0.5)' },
  body: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 0, gap: 10 },
  gap: { gap: 10 },
  field: { gap: 6 },
  label: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '600' },
  group: { color: colors.text, fontSize: 15, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  cyan: { color: '#00e5ff', fontSize: 11, marginTop: 6 },
  error: { color: colors.danger, fontSize: 13 },
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: colors.text,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  textarea: { minHeight: 140, paddingTop: 12 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  two: { flexDirection: 'row', gap: 8 },
  artBox: { width: '100%', aspectRatio: 16 / 9, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.bgElevated },
  artImage: { width: '100%', height: '100%' },
  artEmpty: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 6,
  },
  artTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  artHint: { color: colors.muted, fontSize: 11, textAlign: 'center', lineHeight: 16 },
  artRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapEmpty: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 22,
    gap: 6,
  },
  mapImage: { width: '100%', height: 180, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12 },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
  },
  dateText: { color: colors.text, fontSize: 13, fontWeight: '600', flex: 1 },
  placeholder: { color: 'rgba(255,255,255,0.32)', fontWeight: '500' },
  dateOk: { alignSelf: 'flex-end', paddingVertical: 6 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.blue },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  chipTextOn: { color: colors.loginText },
  termsBox: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 12,
  },
  termsBoxOn: { borderColor: 'rgba(0,123,255,0.5)', backgroundColor: 'rgba(0,123,255,0.10)' },
  check: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  termsText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 19, flex: 1 },
  link: { color: '#00e5ff', fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  ghostBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  ghostText: { color: colors.text, fontWeight: '600' },
  primaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.blue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  primaryText: { color: colors.loginText, fontWeight: '700' },
  off: { opacity: 0.45 },
});
