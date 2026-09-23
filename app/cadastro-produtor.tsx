import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Loader } from '@/components/Loader';
import { Wordmark } from '@/components/Wordmark';
import { colors, siteUrl } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import {
  buildProducerDraft,
  formatCnpj,
  formatCpf,
  formatPhone,
  formatPixKey,
  saveProducerProfile,
  type BankAccountKind,
  type PixKeyType,
  type ProducerDraft,
  type ProducerKind,
} from '@/lib/producer';
import { useProducer } from '@/lib/producer-context';

const STEPS = ['Tipo', 'Dados', 'Fiscal', 'Pix'];

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
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  autoCapitalize?: 'none' | 'words' | 'characters';
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
        style={styles.input}
      />
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function CadastroProdutorScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { status, loading: producerLoading, refresh } = useProducer();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<ProducerDraft | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || producerLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (status === 'producer') router.replace('/home');
  }, [loading, producerLoading, router, status, user]);

  useEffect(() => {
    if (!user || draft) return;
    void buildProducerDraft(user).then(setDraft);
  }, [draft, user]);

  const canGo = useMemo(() => {
    if (!draft) return false;
    if (step === 1) return true;
    if (step === 2) return Boolean(draft.full_name.trim() && draft.email.trim());
    if (step === 3) {
      return draft.kind === 'individual' ? Boolean(draft.cpf.trim()) : Boolean(draft.cnpj.trim());
    }
    return accepted;
  }, [accepted, draft, step]);

  function patch<K extends keyof ProducerDraft>(key: K, value: ProducerDraft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setError(null);
  }

  async function finish() {
    if (!user || !draft) return;
    if (!draft.full_name.trim() || !draft.email.trim()) {
      setError('Informe nome e e-mail.');
      setStep(2);
      return;
    }
    if (draft.kind === 'individual' && !draft.cpf.trim()) {
      setError('Informe o CPF.');
      setStep(3);
      return;
    }
    if (draft.kind === 'company' && !draft.cnpj.trim()) {
      setError('Informe o CNPJ.');
      setStep(3);
      return;
    }
    if (!accepted) {
      setError('Aceite os Termos e a Política de Privacidade para concluir.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await saveProducerProfile(user.id, draft);
      await refresh();
      router.replace('/home');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível salvar o cadastro.');
    } finally {
      setBusy(false);
    }
  }

  if (loading || producerLoading || !user || status === 'producer' || !draft) {
    return (
      <View style={styles.boot}>
        <Loader screen />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Wordmark height={28} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Cadastro de produtor</Text>
        <Text style={styles.lead}>Complete as etapas para começar a publicar seus eventos.</Text>

        <View style={styles.steps}>
          {STEPS.map((label, index) => {
            const id = index + 1;
            const active = step === id;
            const done = step > id;
            return (
              <View key={label} style={styles.stepItem}>
                <View style={[styles.stepDot, (active || done) && styles.stepDotOn]}>
                  <Text style={styles.stepNum}>{id}</Text>
                </View>
                <Text style={[styles.stepLabel, active && styles.stepLabelOn]}>{label}</Text>
              </View>
            );
          })}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {step === 1 ? (
          <View style={styles.block}>
            <Text style={styles.section}>Tipo de cadastro</Text>
            <Pressable
              onPress={() => patch('kind', 'individual')}
              style={[styles.kindCard, draft.kind === 'individual' && styles.kindCardOn]}
            >
              <Ionicons name="person-outline" size={22} color={colors.blue} />
              <View style={styles.kindCopy}>
                <Text style={styles.kindTitle}>Pessoa física</Text>
                <Text style={styles.kindText}>Use seu CPF para emitir e vender ingressos.</Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => patch('kind', 'company' satisfies ProducerKind)}
              style={[styles.kindCard, draft.kind === 'company' && styles.kindCardOn]}
            >
              <Ionicons name="business-outline" size={22} color={colors.blue} />
              <View style={styles.kindCopy}>
                <Text style={styles.kindTitle}>Empresa</Text>
                <Text style={styles.kindText}>Cadastre sua produtora ou empresa com CNPJ.</Text>
              </View>
            </Pressable>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.block}>
            <Text style={styles.section}>Dados básicos</Text>
            <Field label="Nome completo *" value={draft.full_name} onChangeText={(value) => patch('full_name', value)} autoCapitalize="words" />
            <Field label="Nome artístico / marca" value={draft.brand_name} onChangeText={(value) => patch('brand_name', value)} />
            <Field
              label="Telefone"
              value={draft.phone}
              onChangeText={(value) => patch('phone', formatPhone(value))}
              keyboardType="phone-pad"
              placeholder="(00) 00000-0000"
            />
            <Field
              label="WhatsApp"
              value={draft.whatsapp}
              onChangeText={(value) => patch('whatsapp', formatPhone(value))}
              keyboardType="phone-pad"
              placeholder="(00) 00000-0000"
            />
            <Field
              label="E-mail *"
              value={draft.email}
              onChangeText={(value) => patch('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field label="Cidade" value={draft.city} onChangeText={(value) => patch('city', value)} autoCapitalize="words" />
            <Field
              label="Estado (UF)"
              value={draft.state}
              onChangeText={(value) => patch('state', value.toUpperCase().slice(0, 2))}
              autoCapitalize="characters"
              placeholder="SP"
            />
            <Field label="Bio / descrição curta" value={draft.bio} onChangeText={(value) => patch('bio', value)} />
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.block}>
            <Text style={styles.section}>Dados fiscais</Text>
            {draft.kind === 'individual' ? (
              <>
                <Field
                  label="CPF *"
                  value={draft.cpf}
                  onChangeText={(value) => patch('cpf', formatCpf(value))}
                  keyboardType="numeric"
                  placeholder="000.000.000-00"
                />
                <Field
                  label="Data de nascimento"
                  value={draft.birth_date}
                  onChangeText={(value) => patch('birth_date', value)}
                  placeholder="AAAA-MM-DD"
                />
              </>
            ) : (
              <>
                <Field
                  label="CNPJ *"
                  value={draft.cnpj}
                  onChangeText={(value) => patch('cnpj', formatCnpj(value))}
                  keyboardType="numeric"
                  placeholder="00.000.000/0000-00"
                />
                <Field label="Razão social" value={draft.legal_name} onChangeText={(value) => patch('legal_name', value)} />
                <Field label="Nome fantasia" value={draft.trade_name} onChangeText={(value) => patch('trade_name', value)} />
              </>
            )}
          </View>
        ) : null}

        {step === 4 ? (
          <View style={styles.block}>
            <Text style={styles.section}>Dados financeiros</Text>
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
            />
            <Text style={styles.label}>Banco</Text>
            <View style={styles.chips}>
              {BANKS.map((bank) => (
                <Chip key={bank} label={bank} active={draft.bank_name === bank} onPress={() => patch('bank_name', bank)} />
              ))}
            </View>
            <Field label="Agência" value={draft.bank_agency} onChangeText={(value) => patch('bank_agency', value)} keyboardType="numeric" />
            <Field label="Conta" value={draft.bank_account} onChangeText={(value) => patch('bank_account', value)} keyboardType="numeric" />
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
            <Pressable onPress={() => setAccepted((value) => !value)} style={styles.termsRow}>
              <View style={[styles.check, accepted && styles.checkOn]}>
                {accepted ? <Ionicons name="checkmark" size={14} color={colors.loginText} /> : null}
              </View>
              <Text style={styles.terms}>
                Li e aceito os{' '}
                <Text style={styles.termsLink} onPress={() => void Linking.openURL(`${siteUrl}/legal/termos`)}>
                  Termos de Uso
                </Text>
                {' e a '}
                <Text style={styles.termsLink} onPress={() => void Linking.openURL(`${siteUrl}/legal/privacidade`)}>
                  Política de Privacidade
                </Text>
                .
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            onPress={() => (step === 1 ? router.replace('/convite') : setStep((current) => current - 1))}
            style={styles.back}
          >
            <Text style={styles.backText}>{step === 1 ? 'Voltar' : 'Anterior'}</Text>
          </Pressable>
          {step < 4 ? (
            <Pressable
              onPress={() => {
                if (!canGo) {
                  setError(step === 2 ? 'Informe nome e e-mail.' : 'Informe o documento fiscal.');
                  return;
                }
                setError(null);
                setStep((current) => current + 1);
              }}
              style={styles.nextWrap}
            >
              <LinearGradient colors={['#007BFF', '#0056b3']} style={styles.next}>
                <Text style={styles.nextText}>Avançar</Text>
              </LinearGradient>
            </Pressable>
          ) : (
            <Pressable onPress={() => void finish()} disabled={busy} style={styles.nextWrap}>
              <LinearGradient colors={['#007BFF', '#0056b3']} style={styles.next}>
                {busy ? <Loader size={22} color={colors.loginText} /> : <Text style={styles.nextText}>Concluir</Text>}
              </LinearGradient>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  boot: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    height: 36,
    marginHorizontal: 16,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 18,
  },
  lead: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 6,
    marginBottom: 18,
  },
  steps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotOn: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  stepNum: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 12,
  },
  stepLabel: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 6,
  },
  stepLabelOn: {
    color: colors.text,
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  block: {
    gap: 4,
  },
  section: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
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
  input: {
    color: colors.text,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  kindCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 10,
  },
  kindCardOn: {
    borderColor: '#00e5ff',
    backgroundColor: 'rgba(0,229,255,0.08)',
  },
  kindCopy: {
    flex: 1,
  },
  kindTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  kindText: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
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
  termsRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    marginTop: 8,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkOn: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  terms: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  termsLink: {
    color: colors.blue,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  back: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  backText: {
    color: colors.text,
    fontWeight: '600',
  },
  nextWrap: {
    flex: 1,
  },
  next: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: {
    color: colors.loginText,
    fontWeight: '700',
    fontSize: 16,
  },
});
