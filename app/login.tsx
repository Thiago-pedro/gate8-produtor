import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthScreenShell, useAuthKeyboard } from '@/components/AuthScreenShell';
import { Logo } from '@/components/Logo';
import { NeonCard } from '@/components/NeonCard';
import { colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useProducer } from '@/lib/producer-context';

function LoginForm() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { keyboardOpen } = useAuthKeyboard();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim() || !password) {
      setError('Informe e-mail e senha da conta Gate8.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      Keyboard.dismiss();
      await signIn(email, password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível entrar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <View style={[styles.logoWrap, keyboardOpen && styles.logoWrapCompact]}>
        <Logo height={keyboardOpen ? 40 : 56} centered />
        <Text style={styles.brand}>PRODUTOR</Text>
      </View>
      <NeonCard>
        <Text style={styles.title}>Entrar</Text>
        <Text style={styles.lead}>Entre com seu login de produtor para gerenciar seus eventos</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
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
            placeholder="••••••••"
            placeholderTextColor="rgba(255,255,255,0.28)"
            style={[styles.input, styles.passInput]}
            onSubmitEditing={() => void submit()}
          />
          <Pressable onPress={() => setShowPassword((open) => !open)} hitSlop={10} style={styles.eye}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.muted} />
          </Pressable>
        </View>
        <Pressable onPress={() => void submit()} disabled={busy} style={styles.button}>
          {busy ? <ActivityIndicator color={colors.loginText} /> : <Text style={styles.buttonText}>Entrar</Text>}
        </Pressable>
        <Pressable onPress={() => router.push('/cadastro')} style={styles.signupWrap}>
          <Text style={styles.signupMuted}>Ainda não é cliente Gate8?</Text>
          <Text style={styles.signupLink}>Crie sua conta de produtor aqui</Text>
        </Pressable>
      </NeonCard>
    </>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { status, loading: producerLoading } = useProducer();

  useEffect(() => {
    if (loading || producerLoading || !user) return;
    router.replace(status === 'producer' ? '/home' : '/convite');
  }, [loading, producerLoading, router, status, user]);

  return (
    <AuthScreenShell>
      <LoginForm />
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  logoWrap: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoWrapCompact: {
    marginBottom: 16,
  },
  brand: {
    color: colors.blue,
    fontWeight: '800',
    letterSpacing: 4,
    marginTop: 10,
    fontSize: 13,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  lead: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 6,
    marginBottom: 18,
  },
  error: {
    color: colors.danger,
    marginBottom: 12,
    textAlign: 'center',
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
    marginBottom: 14,
  },
  passRow: {
    position: 'relative',
  },
  passInput: {
    paddingRight: 44,
  },
  eye: {
    position: 'absolute',
    right: 14,
    top: 14,
  },
  button: {
    backgroundColor: colors.blue,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: colors.loginText,
    fontWeight: '700',
    fontSize: 16,
  },
  signupWrap: {
    marginTop: 18,
    alignItems: 'center',
    gap: 4,
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
