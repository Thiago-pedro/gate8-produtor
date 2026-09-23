import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthScreenShell } from '@/components/AuthScreenShell';
import { Logo } from '@/components/Logo';
import { NeonCard } from '@/components/NeonCard';
import { Loader } from '@/components/Loader';
import { colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useProducer } from '@/lib/producer-context';

const CLIENT_APP_URL = 'gate8://';

export default function ConviteScreen() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const { status, loading: producerLoading } = useProducer();
  const [busy, setBusy] = useState(false);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    if (loading || producerLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (status === 'producer') router.replace('/home');
  }, [loading, producerLoading, router, status, user]);

  async function leave() {
    setBusy(true);
    try {
      await signOut();
      router.replace('/login');
    } finally {
      setBusy(false);
    }
  }

  async function openClientApp() {
    setBusy(true);
    try {
      const canOpen = await Linking.canOpenURL(CLIENT_APP_URL);
      if (canOpen) {
        await Linking.openURL(CLIENT_APP_URL);
        await leave();
        return;
      }
    } catch {
      // Se o app cliente não estiver instalado, a pessoa lê o aviso e sai por aqui.
    } finally {
      setBusy(false);
    }
  }

  if (loading || producerLoading || !user || status === 'producer') {
    return (
      <View style={styles.boot}>
        <Loader screen />
      </View>
    );
  }

  return (
    <AuthScreenShell>
      <View style={styles.logoWrap}>
        <Logo height={56} centered />
        <Text style={styles.brand}>PRODUTOR</Text>
      </View>
      <NeonCard>
        {declined ? (
          <>
            <Ionicons name="phone-portrait-outline" size={28} color={colors.blue} style={styles.icon} />
            <Text style={styles.title}>Este app é só para produtores</Text>
            <Text style={styles.lead}>
              Aqui não dá para comprar ingresso. Baixe o app Gate8, o app do cliente, para ver seus ingressos e entrar nos eventos.
            </Text>
            <Pressable onPress={() => void openClientApp()} disabled={busy} style={styles.yesWrap}>
              <LinearGradient
                colors={['#007BFF', '#0056b3']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.yes}
              >
                {busy ? (
                  <Loader size={22} color={colors.loginText} />
                ) : (
                  <Text style={styles.yesText}>Abrir o app Gate8</Text>
                )}
              </LinearGradient>
            </Pressable>
            <Pressable onPress={() => void leave()} disabled={busy} style={styles.no}>
              <Text style={styles.noText}>Sair</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Ionicons name="calendar-outline" size={28} color={colors.blue} style={styles.icon} />
            <Text style={styles.title}>Você já faz parte da Gate8</Text>
            <Text style={styles.lead}>Gostaria de criar seu evento com a gente?</Text>
            <Pressable onPress={() => router.replace('/cadastro-produtor')} style={styles.yesWrap}>
              <LinearGradient
                colors={['#007BFF', '#0056b3']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.yes}
              >
                <Text style={styles.yesText}>Sim, quero produzir</Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={() => setDeclined(true)} style={styles.no}>
              <Text style={styles.noText}>Agora não</Text>
            </Pressable>
          </>
        )}
      </NeonCard>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brand: {
    color: colors.blue,
    fontWeight: '800',
    letterSpacing: 4,
    marginTop: 10,
    fontSize: 13,
  },
  icon: {
    alignSelf: 'center',
    marginBottom: 10,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  lead: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 22,
  },
  yesWrap: {
    width: '100%',
  },
  yes: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yesText: {
    color: colors.loginText,
    fontWeight: '700',
    fontSize: 16,
  },
  no: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  noText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
});
