import { DarkTheme, ThemeProvider, type ErrorBoundaryProps, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { AuthProvider } from '@/lib/auth-context';
import { ProducerProvider } from '@/lib/producer-context';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: 'index',
};

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.errorScreen}>
      <Text style={styles.errorTitle}>Erro ao abrir o painel</Text>
      <Text style={styles.errorText}>{error.message}</Text>
      <Pressable onPress={retry} style={styles.retry}>
        <Text style={styles.retryText}>Tentar de novo</Text>
      </Pressable>
    </View>
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
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);
  return children;
}

export default function RootLayout() {
  return (
    <ThemeProvider value={navTheme}>
      <AuthProvider>
        <ProducerProvider>
          <StatusBar style="light" />
          <BootSplash>
            <Stack
              initialRouteName="index"
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
        </ProducerProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  errorScreen: {
    flex: 1,
    backgroundColor: colors.bg,
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
