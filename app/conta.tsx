import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Loader } from '@/components/Loader';
import { SiteFooter } from '@/components/SiteFooter';
import { colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { fetchSharedMenu } from '@/lib/team';
import {
  biometricsAvailable,
  confirmDeviceOwner,
  readBiometricPreference,
  writeBiometricPreference,
} from '@/lib/biometric';
import { lookupCep } from '@/lib/create-event';
import {
  fetchProducerAccount,
  formatCep,
  formatCnpj,
  formatPhone,
  formatPixKey,
  producerAccountError,
  updateProducerAccount,
  uploadProducerLogo,
  type BankAccountKind,
  type PixKeyType,
  type ProducerDraft,
  type ProducerKind,
} from '@/lib/producer';
import { useProducer } from '@/lib/producer-context';

const BANKS = [
  'Banco do Brasil',
  'Santander',
  'Caixa Econômica Federal',
  'Bradesco',
  'Itaú Unibanco',
  'Nubank',
  'Inter',
  'C6 Bank',
  'PagBank (PagSeguro)',
  'PicPay',
  'Stone',
  'Sicredi',
  'Sicoob',
];

const PIX_TYPES: { id: PixKeyType; label: string }[] = [
  { id: 'cpf', label: 'CPF' },
  { id: 'cnpj', label: 'CNPJ' },
  { id: 'email', label: 'E-mail' },
  { id: 'phone', label: 'Celular' },
  { id: 'random', label: 'Aleatória' },
];

const ACCOUNT_KINDS: { id: Exclude<BankAccountKind, ''>; label: string }[] = [
  { id: 'checking', label: 'Corrente' },
  { id: 'savings', label: 'Poupança' },
  { id: 'payment', label: 'Pagamento' },
];

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  locked,
}: {
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  autoCapitalize?: 'none' | 'words' | 'characters';
  locked?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.28)"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        editable={!locked}
        style={[styles.input, locked && styles.inputLocked]}
      />
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function ContaScreen() {
  const router = useRouter();
  const { user, loading, locked } = useAuth();
  const { status, loading: producerLoading } = useProducer();
  const [draft, setDraft] = useState<ProducerDraft | null>(null);
  const [logo, setLogo] = useState<{ uri: string; type: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [bio, setBio] = useState<'on' | 'off' | 'hidden'>('hidden');
  const [bioOff, setBioOff] = useState(false);

  useEffect(() => {
    if (loading || producerLoading || locked) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (status !== 'guest') return;
    let alive = true;
    void fetchSharedMenu(user.id, user.email).then((menu) => {
      if (!alive) return;
      router.replace(menu.visible ? '/home' : '/convite');
    });
    return () => {
      alive = false;
    };
  }, [loading, locked, producerLoading, router, status, user]);

  useEffect(() => {
    if (!user || status !== 'producer') return;
    let alive = true;
    void fetchProducerAccount(user.id)
      .then((next) => {
        if (alive) setDraft(next);
      })
      .catch((caught) => {
        if (alive) setError(caught instanceof Error ? caught.message : 'Não foi possível abrir a conta.');
      });
    return () => {
      alive = false;
    };
  }, [status, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const available = await biometricsAvailable();
      if (!available) {
        if (!cancelled) setBio('hidden');
        return;
      }
      const preference = await readBiometricPreference(user.id);
      if (!cancelled) setBio(preference === 'on' ? 'on' : 'off');
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  function toggleBio() {
    if (!user) return;
    if (bio === 'on') {
      setBioOff(true);
      return;
    }
    void (async () => {
      const accepted = await confirmDeviceOwner();
      if (!accepted) return;
      await writeBiometricPreference(user.id, 'on');
      setBio('on');
    })();
  }

  function patch<K extends keyof ProducerDraft>(key: K, value: ProducerDraft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setError(null);
    setSaved(null);
  }

  async function pickLogo() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      setError('Imagem muito grande (máx 5MB).');
      return;
    }
    setLogo({ uri: asset.uri, type: asset.mimeType || 'image/jpeg' });
    setSaved(null);
  }

  async function fillCompanyCep() {
    if (!draft) return;
    try {
      const found = await lookupCep(draft.company_cep);
      if (!found) return;
      setDraft((current) =>
        current
          ? {
              ...current,
              company_street: found.street || current.company_street,
              company_neighborhood: found.neighborhood || current.company_neighborhood,
              company_city: found.city || current.company_city,
              company_state: found.state || current.company_state,
            }
          : current
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'CEP não encontrado.');
    }
  }

  async function save() {
    if (!user || !draft) return;
    const problem = producerAccountError(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      let next = draft;
      if (logo) {
        const logoUrl = await uploadProducerLogo(user.id, logo.uri, logo.type);
        next = { ...draft, logo_url: logoUrl };
        setDraft(next);
        setLogo(null);
      }
      const result = await updateProducerAccount(user.id, next);
      setSaved(result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível salvar o cadastro.');
    } finally {
      setBusy(false);
    }
  }

  if (loading || producerLoading || !user || status !== 'producer' || !draft) {
    return (
      <View style={styles.boot}>
        {error ? <Text style={styles.error}>{error}</Text> : <Loader screen />}
      </View>
    );
  }

  const preview = logo?.uri || draft.logo_url;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Minha conta</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>Atualize suas informações de produtor.</Text>
        <Text style={styles.note}>
          Nome, telefone, e-mail, cidade e estado não podem ser alterados. No cadastro de pessoa física, CPF e data de nascimento também ficam fixos.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {saved ? <Text style={styles.saved}>{saved}</Text> : null}

        {bio !== 'hidden' ? (
          <Pressable onPress={toggleBio} style={styles.bioCard}>
            <Ionicons name="finger-print-outline" size={22} color={colors.blue} />
            <View style={styles.bioCopy}>
              <Text style={styles.bioTitle}>Desbloqueio do celular</Text>
              <Text style={styles.bioSub}>
                {bio === 'on'
                  ? 'Ativado. O celular abre a sua conta.'
                  : 'Use a digital ou o rosto deste aparelho.'}
              </Text>
            </View>
          </Pressable>
        ) : null}

        <Text style={styles.section}>Dados da conta</Text>
        <Field label="Nome completo" value={draft.full_name} locked />
        <Field label="Telefone" value={draft.phone} locked />
        <Field label="E-mail" value={draft.email} locked />
        <Field label="Cidade" value={draft.city} locked />
        <Field label="Estado (UF)" value={draft.state} locked />
        {draft.kind === 'individual' ? (
          <>
            <Field label="CPF" value={draft.cpf} locked />
            <Field label="Data de nascimento" value={draft.birth_date} locked />
          </>
        ) : null}

        <Text style={styles.section}>O que você pode atualizar</Text>
        <Text style={styles.label}>Tipo de cadastro</Text>
        <View style={styles.kinds}>
          <Pressable
            onPress={() => patch('kind', 'individual' satisfies ProducerKind)}
            style={[styles.kindCard, draft.kind === 'individual' && styles.kindCardOn]}
          >
            <Text style={styles.kindTitle}>Pessoa física</Text>
          </Pressable>
          <Pressable
            onPress={() => patch('kind', 'company')}
            style={[styles.kindCard, draft.kind === 'company' && styles.kindCardOn]}
          >
            <Text style={styles.kindTitle}>Empresa</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Foto de perfil / logo</Text>
        <View style={styles.logoRow}>
          {preview ? <Image source={{ uri: preview }} style={styles.logo} /> : <View style={styles.logo} />}
          <View style={styles.logoActions}>
            <Pressable onPress={() => void pickLogo()} style={styles.ghostBtn}>
              <Text style={styles.ghostText}>{preview ? 'Trocar foto' : 'Enviar foto'}</Text>
            </Pressable>
            {preview ? (
              <Pressable
                onPress={() => {
                  setLogo(null);
                  patch('logo_url', '');
                }}
                style={styles.ghostBtn}
              >
                <Text style={styles.ghostText}>Remover</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <Field label="Nome artístico / marca / produtora" value={draft.brand_name} onChangeText={(value) => patch('brand_name', value)} />
        <Field
          label="Instagram"
          value={draft.instagram}
          onChangeText={(value) => patch('instagram', value.slice(0, 200))}
          placeholder="@usuario ou link"
          autoCapitalize="none"
        />
        <Field
          label="Facebook"
          value={draft.facebook}
          onChangeText={(value) => patch('facebook', value.slice(0, 200))}
          placeholder="@usuario ou link"
          autoCapitalize="none"
        />
        <Text style={styles.hint}>Preencha pelo menos uma rede social.</Text>
        <Field
          label="WhatsApp"
          value={draft.whatsapp}
          onChangeText={(value) => patch('whatsapp', formatPhone(value))}
          keyboardType="phone-pad"
          placeholder="(00) 00000-0000"
        />
        <Field label="Bio / descrição curta" value={draft.bio} onChangeText={(value) => patch('bio', value)} />

        {draft.kind === 'company' ? (
          <>
            <Text style={styles.section}>Dados fiscais da empresa</Text>
            <Field
              label="CNPJ *"
              value={draft.cnpj}
              onChangeText={(value) => patch('cnpj', formatCnpj(value))}
              keyboardType="numeric"
              placeholder="00.000.000/0000-00"
            />
            <Field label="Razão social" value={draft.legal_name} onChangeText={(value) => patch('legal_name', value)} />
            <Field label="Nome fantasia" value={draft.trade_name} onChangeText={(value) => patch('trade_name', value)} />
            <Field
              label="E-mail da empresa *"
              value={draft.company_email}
              onChangeText={(value) => patch('company_email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="contato@empresa.com.br"
            />
            <Text style={styles.hint}>A confirmação da conta de produtor é enviada para este e-mail.</Text>
            <Field
              label="CEP *"
              value={draft.company_cep}
              onChangeText={(value) => patch('company_cep', formatCep(value))}
              keyboardType="numeric"
              placeholder="00000-000"
            />
            <Pressable onPress={() => void fillCompanyCep()} style={styles.ghostBtn}>
              <Text style={styles.ghostText}>Buscar CEP</Text>
            </Pressable>
            <Field label="Endereço *" value={draft.company_street} onChangeText={(value) => patch('company_street', value)} />
            <Field label="Número *" value={draft.company_number} onChangeText={(value) => patch('company_number', value)} />
            <Field label="Complemento" value={draft.company_complement} onChangeText={(value) => patch('company_complement', value)} />
            <Field label="Bairro *" value={draft.company_neighborhood} onChangeText={(value) => patch('company_neighborhood', value)} />
            <Field label="Cidade da empresa *" value={draft.company_city} onChangeText={(value) => patch('company_city', value)} autoCapitalize="words" />
            <Field
              label="Estado da empresa *"
              value={draft.company_state}
              onChangeText={(value) => patch('company_state', value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2))}
              autoCapitalize="characters"
              placeholder="SP"
            />
          </>
        ) : null}

        <Text style={styles.section}>Dados financeiros</Text>
        <Text style={styles.hint}>A receita dos seus eventos é recebida nesta conta.</Text>
        <Text style={styles.label}>Tipo de chave Pix</Text>
        <View style={styles.chips}>
          {PIX_TYPES.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              active={draft.pix_key_type === item.id}
              onPress={() => {
                patch('pix_key_type', item.id);
                patch('pix_key', '');
              }}
            />
          ))}
        </View>
        <Field
          label="Chave Pix"
          value={draft.pix_key}
          onChangeText={(value) => patch('pix_key', formatPixKey(value, draft.pix_key_type))}
          autoCapitalize="none"
          keyboardType={draft.pix_key_type === 'email' ? 'email-address' : 'default'}
        />
        <Field label="Banco" value={draft.bank_name} onChangeText={(value) => patch('bank_name', value)} />
        <View style={styles.chips}>
          {BANKS.map((bank) => (
            <Chip key={bank} label={bank} active={draft.bank_name === bank} onPress={() => patch('bank_name', bank)} />
          ))}
        </View>
        <Field label="Agência" value={draft.bank_agency} onChangeText={(value) => patch('bank_agency', value)} />
        <Field label="Conta" value={draft.bank_account} onChangeText={(value) => patch('bank_account', value)} />
        <Text style={styles.label}>Tipo de conta</Text>
        <View style={styles.chips}>
          {ACCOUNT_KINDS.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              active={draft.bank_account_kind === item.id}
              onPress={() => patch('bank_account_kind', item.id)}
            />
          ))}
        </View>

        <Pressable onPress={() => void save()} disabled={busy} style={styles.saveWrap}>
          <LinearGradient colors={['#007BFF', '#0056b3']} style={styles.save}>
            {busy ? <Loader size={22} color={colors.loginText} /> : <Text style={styles.saveText}>Salvar</Text>}
          </LinearGradient>
        </Pressable>
        <SiteFooter />
      </ScrollView>
      <Modal visible={bioOff} transparent animationType="fade" onRequestClose={() => setBioOff(false)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>Desbloqueio do celular</Text>
            <Text style={styles.dialogMessage}>O Gate8 deixa de pedir a digital ou o rosto para abrir.</Text>
            <Pressable onPress={() => setBioOff(false)} style={styles.dialogGhost}>
              <Text style={styles.dialogGhostText}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setBioOff(false);
                if (!user) return;
                void writeBiometricPreference(user.id, 'off').then(() => setBio('off'));
              }}
              style={styles.dialogPrimary}
            >
              <Text style={styles.dialogPrimaryText}>Desativar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  boot: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    height: 44,
    marginHorizontal: 12,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 26,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  lead: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  bioCard: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,123,255,0.35)',
    borderRadius: 16,
    backgroundColor: colors.bgCard,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bioCopy: {
    flex: 1,
  },
  bioTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  bioSub: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5,13,31,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,123,255,0.35)',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
  },
  dialogTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  dialogMessage: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
  },
  dialogPrimary: {
    height: 46,
    marginTop: 8,
    borderRadius: 24,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogPrimaryText: {
    color: colors.loginText,
    fontWeight: '800',
    fontSize: 14,
  },
  dialogGhost: {
    height: 46,
    marginTop: 18,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogGhostText: {
    color: colors.blue,
    fontWeight: '800',
    fontSize: 14,
  },
  note: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 12,
  },
  section: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 10,
  },
  field: {
    marginBottom: 10,
  },
  label: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 6,
  },
  hint: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: 10,
  },
  input: {
    color: colors.text,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputLocked: {
    color: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  kinds: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  kindCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  kindCardOn: {
    borderColor: '#00e5ff',
    backgroundColor: 'rgba(0,229,255,0.08)',
  },
  kindTitle: {
    color: colors.text,
    fontWeight: '700',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  logoActions: {
    gap: 8,
  },
  ghostBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  ghostText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  chipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.loginText,
  },
  error: {
    color: colors.danger,
    marginBottom: 8,
  },
  saved: {
    color: colors.success,
    marginBottom: 8,
  },
  saveWrap: {
    marginTop: 8,
  },
  save: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    color: colors.loginText,
    fontWeight: '700',
    fontSize: 16,
  },
});
