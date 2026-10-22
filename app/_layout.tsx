import { DarkTheme, ThemeProvider, useSegments, type ErrorBoundaryProps, Stack } from 'expo-router';
import { NavigationBar } from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/AppBackground';
import { colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { ProducerProvider, useProducer } from '@/lib/producer-context';

SplashScreen.setOptions({ duration: 0, fade: false });
SplashScreen.preventAutoHideAsync();

const SPLASH_HOLD_MS = 2500;
const SPLASH_FADE_MS = 460;

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
  const [cover, setCover] = useState(true);
  const [art, setArt] = useState(true);
  const [held, setHeld] = useState(false);
  const veil = useRef(new Animated.Value(0)).current;
  const leaving = useRef(false);
  const leaf = segments[segments.length - 1];
  const destination =
    leaf === 'login' || leaf === 'home' || leaf === 'convite' || leaf === 'cadastro-produtor';

  function leaveSplash() {
    if (leaving.current) return;
    leaving.current = true;
    Animated.timing(veil, {
      toValue: 1,
      duration: SPLASH_FADE_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setArt(false);
      Animated.timing(veil, {
        toValue: 0,
        duration: SPLASH_FADE_MS,
        useNativeDriver: true,
      }).start(({ finished: revealed }) => {
        if (revealed) setCover(false);
      });
    });
  }

  useEffect(() => {
    const timer = setTimeout(() => setHeld(true), SPLASH_HOLD_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (held && !loading && !producerLoading && destination) leaveSplash();
  }, [destination, held, loading, producerLoading]);

  useEffect(() => {
    const max = setTimeout(() => leaveSplash(), 6000);
    return () => clearTimeout(max);
  }, []);

  return (
    <View style={styles.app}>
      {children}
      {cover ? (
        <View pointerEvents="auto" style={styles.opening}>
          {art ? (
            <Image
              source={require('../assets/images/splash.png')}
              resizeMode="cover"
              fadeDuration={0}
              onLoad={() => {
                SplashScreen.setOptions({ duration: 0, fade: false });
                void SplashScreen.hideAsync();
              }}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <Animated.View pointerEvents="none" style={[styles.veil, { opacity: veil }]} />
        </View>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  const insets = useSafeAreaInsets();

  return (
    <ThemeProvider value={navTheme}>
      <AuthProvider>
        <ProducerProvider>
          <View style={styles.appRoot}>
            <StatusBar style="light" />
            {Platform.OS === 'android' ? <NavigationBar style="light" /> : null}
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
            {Platform.OS === 'android' && insets.bottom > 0 ? (
              <View pointerEvents="none" style={[styles.navScrim, { height: insets.bottom }]} />
            ) : null}
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
  navScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    zIndex: 40,
  },
  opening: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 24,
    backgroundColor: 'transparent',
  },
  veil: {
    ...StyleSheet.absoluteFillObject,
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
