import { DarkTheme, ThemeProvider, useSegments, type ErrorBoundaryProps, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';

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
  const segments = useSegments();
  const opacity = useRef(new Animated.Value(1)).current;
  const fading = useRef(false);
  const [cover, setCover] = useState(true);
  const [minHold, setMinHold] = useState(true);
  const leaf = segments[segments.length - 1];
  const destination =
    leaf === 'login' || leaf === 'home' || leaf === 'convite' || leaf === 'cadastro-produtor';

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setMinHold(false), 900);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const max = setTimeout(() => setCover(false), 5600);
    return () => clearTimeout(max);
  }, []);

  useEffect(() => {
    if (fading.current || cover === false || minHold || loading || producerLoading || !destination) return;
    const timer = setTimeout(() => {
      fading.current = true;
      Animated.timing(opacity, {
        toValue: 0,
        duration: 380,
        useNativeDriver: true,
      }).start(() => setCover(false));
    }, 220);
    return () => clearTimeout(timer);
  }, [cover, destination, loading, minHold, opacity, producerLoading]);

  return (
    <View style={styles.app}>
      {children}
      {cover ? (
        <Animated.View
          pointerEvents="auto"
          needsOffscreenAlphaCompositing
          style={[styles.opening, { opacity }]}
        >
          <Image
            source={require('../assets/images/splash.png')}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={navTheme}>
      <AuthProvider>
        <ProducerProvider>
          <View style={styles.appRoot}>
            <StatusBar style="light" />
            <BootSplash>
              <Stack
                initialRouteName="index"
                screenLayout={({ children }) => <AppBackground>{children}</AppBackground>}
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: '#000000' },
                }}
              >
                <Stack.Screen name="index" options={{ animation: 'none' }} />
                <Stack.Screen name="login" options={{ animation: 'none' }} />
                <Stack.Screen name="cadastro" options={{ animation: 'none' }} />
                <Stack.Screen name="convite" options={{ animation: 'none' }} />
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
    backgroundColor: '#000000',
  },
  appRoot: {
    flex: 1,
    backgroundColor: '#000000',
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
