import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthScreenShell, useAuthKeyboard } from '@/components/AuthScreenShell';
import { NeonCard } from '@/components/NeonCard';
import { colors } from '@/constants/theme';
import { isValidCpf } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';
import { formatCpf } from '@/lib/producer';
import { useProducer } from '@/lib/producer-context';

function passwordStrength(password: string) {
  if (!password) return { score: 0, label: '', strong: false, acceptable: false };
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  const sequence = /^(?:0123456789|1234567890|9876543210|0987654321)/.test(password);
  const repeated = /^(.)\1+$/.test(password);
  if (password.length >= 8 && kinds >= 3 && !sequence && !repeated) {
    return { score: 3, label: 'Senha forte', strong: true, acceptable: true };
  }
  if (password.length >= 8 && kinds >= 2 && !sequence && !repeated) {
    return { score: 2, label: 'Senha média', strong: false, acceptable: true };
  }
  return { score: 1, label: 'Senha fraca', strong: false, acceptable: false };
}

const LOGIN_LOGO = require('../assets/images/logo-kit-original.png');
const LOGIN_LOGO_ASPECT = 1009 / 165;
const PRODUCER_BLUE = '#0000fe';
const GATE_SILVER = '#B9BBC6';

function SignupForm() {
  const router = useRouter();
  const { signUp } = useAuth();
  const { keyboardOpen } = useAuthKeyboard();
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const strength = passwordStrength(password);

  async function submit() {
    if (!name.trim() || !email.trim()) {
      setError('Informe nome e e-mail.');
      return;
    }
    if (!passwordStrength(password).acceptable) {
      setError('A senha ainda está fraca. Use 8 caracteres e combine letras, números ou símbolos.');
      return;
    }
    if (!isValidCpf(cpf)) {
      setError('Informe um CPF válido.');
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      Keyboard.dismiss();
      const result = await signUp(email, password, name, cpf);
      if (result.needsConfirmation) {
        setInfo('Conta criada. Confirme o e-mail e volte para entrar.');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível criar a conta.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <View style={[styles.logoWrap, keyboardOpen && styles.logoWrapCompact]}>
        <Image
          accessibilityLabel="Gate8"
          source={LOGIN_LOGO}
          style={{
            height: keyboardOpen ? 32 : 44.8,
            width: (keyboardOpen ? 32 : 44.8) * LOGIN_LOGO_ASPECT,
          }}
          resizeMode="contain"
        />
        <Text style={styles.brand}>MANAGER</Text>
      </View>
      <NeonCard accent={PRODUCER_BLUE} contentStyle={styles.card}>
        <Text style={styles.title}>Criar conta</Text>
        <Text style={styles.lead}>Cadastre-se para publicar eventos e gerar o token da portaria.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}
        <Text style={styles.label}>NOME</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          placeholder="Seu nome"
          placeholderTextColor="rgba(255,255,255,0.28)"
          style={styles.input}
        />
        <Text style={styles.label}>CPF</Text>
        <TextInput
          value={cpf}
          onChangeText={(value) => setCpf(formatCpf(value))}
          keyboardType="numeric"
          placeholder="000.000.000-00"
          placeholderTextColor="rgba(255,255,255,0.28)"
          style={styles.input}
        />
        <Text style={styles.label}>E-MAIL</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="voce@email.com"
          placeholderTextColor="rgba(255,255,255,0.28)"
          style={styles.input}
        />
        <Text style={styles.label}>SENHA</Text>
        <View style={styles.passRow}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            placeholder="Sua senha"
            placeholderTextColor="rgba(255,255,255,0.28)"
            style={[styles.input, styles.passInput]}
            onSubmitEditing={() => void submit()}
          />
          <Pressable onPress={() => setShowPassword((open) => !open)} hitSlop={10} style={styles.eye}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.muted} />
          </Pressable>
        </View>
        <View style={styles.meter} accessibilityLiveRegion="polite">
          <View style={styles.meterBars}>
            {[1, 2, 3].map((step) => {
              const on = strength.score >= step;
              const color = !on
                ? 'rgba(255,255,255,0.10)'
                : strength.strong
                  ? '#007BFF'
                  : strength.acceptable
                    ? '#fbbf24'
                    : '#ef4444';
              return <View key={step} style={[styles.meterBar, { backgroundColor: color }]} />;
            })}
          </View>
          <View style={styles.meterRow}>
            <Text
              style={[
                styles.meterLabel,
                strength.strong
                  ? styles.meterStrong
                  : strength.acceptable
                    ? styles.meterMedium
                    : password
                      ? styles.meterWeak
                      : styles.meterIdle,
              ]}
            >
              {strength.label || 'Digite uma senha'}
            </Text>
            {strength.strong ? null : (
              <Text style={styles.meterHint} numberOfLines={2}>
                Use 8 caracteres e combine 3 tipos: maiúsculas, minúsculas, números ou símbolos.
              </Text>
            )}
          </View>
        </View>
        <Pressable
          onPress={() => void submit()}
          disabled={busy || !strength.acceptable}
          style={[styles.button, !strength.acceptable && styles.buttonOff]}
        >
          {busy ? <ActivityIndicator color={colors.loginText} /> : <Text style={styles.buttonText}>Criar conta</Text>}
        </Pressable>
        <Pressable onPress={() => router.replace('/login')} style={styles.signupWrap}>
          <Text style={styles.signupMuted}>Já tem conta?</Text>
          <Text style={styles.signupLink}>Entrar</Text>
        </Pressable>
      </NeonCard>
    </>
  );
}

export default function CadastroScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { status, loading: producerLoading } = useProducer();

  useEffect(() => {
    if (loading || producerLoading || !user) return;
    router.replace(status === 'producer' ? '/home' : '/cadastro-produtor');
  }, [loading, producerLoading, router, status, user]);

  return (
    <AuthScreenShell>
      <SignupForm />
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  logoWrap: {
    alignItems: 'center',
    marginTop: -22,
    marginBottom: 26,
  },
  logoWrapCompact: {
    marginBottom: 8,
  },
  brand: {
    color: GATE_SILVER,
    fontWeight: '800',
    letterSpacing: 4,
    marginTop: 4,
    fontSize: 12,
  },
  card: {
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  lead: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 17,
    marginTop: 2,
    marginBottom: 8,
  },
  error: {
    color: colors.danger,
    marginBottom: 12,
    textAlign: 'center',
  },
  info: {
    color: colors.success,
    marginBottom: 12,
    textAlign: 'center',
  },
  label: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 3,
  },
  input: {
    color: colors.text,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 8,
  },
  passRow: {
    position: 'relative',
  },
  passInput: {
    paddingRight: 44,
    marginBottom: 8,
  },
  meter: {
    gap: 4,
    marginBottom: 8,
  },
  meterBars: {
    flexDirection: 'row',
    gap: 6,
  },
  meterBar: {
    flex: 1,
    height: 6,
    borderRadius: 999,
  },
  meterRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  meterLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  meterIdle: {
    color: '#64748b',
    fontWeight: '400',
  },
  meterWeak: {
    color: '#ef4444',
  },
  meterMedium: {
    color: '#fcd34d',
  },
  meterStrong: {
    color: '#66b2ff',
  },
  meterHint: {
    flex: 1,
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'right',
  },
  eye: {
    position: 'absolute',
    right: 14,
    top: 10,
  },
  button: {
    backgroundColor: colors.blue,
    borderRadius: 12,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  buttonOff: {
    opacity: 0.45,
  },
  buttonText: {
    color: colors.loginText,
    fontWeight: '700',
    fontSize: 16,
  },
  signupWrap: {
    marginTop: 8,
    alignItems: 'center',
    gap: 2,
  },
  signupMuted: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  signupLink: {
    color: colors.blue,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
