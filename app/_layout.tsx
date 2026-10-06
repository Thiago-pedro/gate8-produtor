import { DarkTheme, ThemeProvider, type ErrorBoundaryProps, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppBackground } from '@/components/AppBackground';
import { colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { ProducerProvider, useProducer } from '@/lib/producer-context';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: 'index',
};

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <AppBackground>
      <View style={styles.errorScreen}>
        <Text style={styles.errorTitle}>Erro ao abrir o painel</Text>
        <Text style={styles.errorText}>{error.message}</Text>
        <Pressable onPress={retry} style={styles.retry}>
          <Text style={styles.retryText}>Tentar de novo</Text>
        </Pressable>
      </View>
    </AppBackground>
  );
}

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    primary: colors.blue,
    text: colors.text,
    border: colors.border,
  },
};

function BootSplash({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  const { loading: producerLoading } = useProducer();
  const [holdSplash, setHoldSplash] = useState(true);

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    const max = setTimeout(() => setHoldSplash(false), 4500);
    return () => clearTimeout(max);
  }, []);

  useEffect(() => {
    if (loading || producerLoading) return;
    const timer = setTimeout(() => setHoldSplash(false), 1400);
    return () => clearTimeout(timer);
  }, [loading, producerLoading]);

  return (
    <View style={styles.app}>
      {children}
      {holdSplash ? (
        <Image
          source={require('../assets/images/splash.png')}
          resizeMode="cover"
          style={styles.opening}
        />
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={navTheme}>
      <AuthProvider>
        <ProducerProvider>
          <View style={styles.app}>
            <StatusBar style="light" />
            <BootSplash>
              <Stack
                initialRouteName="index"
                screenLayout={({ children }) => <AppBackground>{children}</AppBackground>}
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.bg },
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="login" />
                <Stack.Screen name="cadastro" />
                <Stack.Screen name="convite" />
                <Stack.Screen name="cadastro-produtor" />
                <Stack.Screen name="home" />
                <Stack.Screen name="evento/novo" />
                <Stack.Screen name="evento/[id]" />
              </Stack>
            </BootSplash>
          </View>
        </ProducerProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
  },
  opening: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 24,
    backgroundColor: '#000000',
  },
  errorScreen: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  retry: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.blue,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryText: {
    color: colors.text,
    fontWeight: '700',
  },
});
