import { isRunningInExpoGo } from 'expo';
import { DarkTheme, ThemeProvider, useSegments, type ErrorBoundaryProps, Stack } from 'expo-router';
import { NavigationBar } from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode } from 'react';
import { Appearance, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/AppBackground';
import { BiometricGate } from '@/components/BiometricGate';
import { colors } from '@/constants/theme';
import { AuthProvider } from '@/lib/auth-context';
import { ErrorNoticeProvider } from '@/lib/error-notice';
import { ProducerProvider } from '@/lib/producer-context';

const expoGo = isRunningInExpoGo();

SplashScreen.preventAutoHideAsync();
if (!expoGo) SplashScreen.setOptions({ duration: 0, fade: false });
Appearance.setColorScheme('dark');

export const unstable_settings = {
  initialRouteName: 'index',
};

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <AppBackground>
      <SafeAreaView style={styles.errorScreen} edges={['top', 'bottom']}>
        <Text style={styles.errorTitle}>Erro ao abrir o painel</Text>
        <Text style={styles.errorText}>{error.message}</Text>
        <Pressable onPress={retry} style={styles.retry}>
          <Text style={styles.retryText}>Tentar de novo</Text>
        </Pressable>
      </SafeAreaView>
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

/** Splash do index fica preto puro, sem o fundo do app por baixo. */
function ScreenShell({ children }: { children: ReactNode }) {
  const segments = useSegments();
  const leaf = segments[segments.length - 1];
  if (!leaf || leaf === 'index') return <>{children}</>;
  return <AppBackground>{children}</AppBackground>;
}

export default function RootLayout() {
  const insets = useSafeAreaInsets();

  return (
    <ThemeProvider value={navTheme}>
      <AuthProvider>
        <ProducerProvider>
          <ErrorNoticeProvider>
            <View style={styles.appRoot}>
              <StatusBar style="light" />
              {Platform.OS === 'android' ? <NavigationBar style="light" /> : null}
              <Stack
                initialRouteName="index"
                screenLayout={({ children }) => <ScreenShell>{children}</ScreenShell>}
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: '#000000' },
                  animation: 'none',
                }}
              >
                <Stack.Screen name="index" options={{ animation: 'none' }} />
                <Stack.Screen name="login" options={{ animation: 'none' }} />
                <Stack.Screen name="cadastro" options={{ animation: 'none' }} />
                <Stack.Screen name="convite" options={{ animation: 'none' }} />
                <Stack.Screen name="cadastro-produtor" />
                <Stack.Screen name="home" options={{ animation: 'none' }} />
                <Stack.Screen name="compartilhados" />
                <Stack.Screen name="conta" />
                <Stack.Screen name="evento/novo" />
                <Stack.Screen name="evento/[id]" />
              </Stack>
              <BiometricGate />
              {Platform.OS === 'android' && insets.bottom > 0 ? (
                <View pointerEvents="none" style={[styles.navScrim, { height: insets.bottom }]} />
              ) : null}
            </View>
          </ErrorNoticeProvider>
        </ProducerProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  navScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    zIndex: 40,
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
