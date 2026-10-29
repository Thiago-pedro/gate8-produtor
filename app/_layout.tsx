import { isRunningInExpoGo } from 'expo';
import { DarkTheme, ThemeProvider, useSegments, type ErrorBoundaryProps, Stack } from 'expo-router';
import { NavigationBar } from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Appearance, Dimensions, Image, Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/AppBackground';
import { BiometricGate } from '@/components/BiometricGate';
import { colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { ProducerProvider, useProducer } from '@/lib/producer-context';

SplashScreen.preventAutoHideAsync();
Appearance.setColorScheme('dark');

function hideNativeSplash() {
  if (!isRunningInExpoGo()) {
    SplashScreen.setOptions({ duration: 0, fade: false });
  }
  void SplashScreen.hideAsync();
}

const SPLASH_HOLD_MS = 2500;
const SPLASH_FADE_MS = 560;
const expoGo = isRunningInExpoGo();

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
  const { loading, locked } = useAuth();
  const { loading: producerLoading } = useProducer();
  const segments = useSegments();
  const [cover, setCover] = useState(true);
  const [held, setHeld] = useState(false);
  const [phase, setPhase] = useState<'hold' | 'darken'>('hold');
  const veil = useRef(new Animated.Value(0)).current;
  const scene = useRef(new Animated.Value(expoGo ? 0 : 1)).current;
  const fading = useRef(false);
  const windowSize = useWindowDimensions();
  const screenSize = Dimensions.get('screen');
  const splashWidth = Math.max(windowSize.width, screenSize.width);
  const splashHeight = Math.max(windowSize.height, screenSize.height);
  const leaf = segments[segments.length - 1];
  const destination =
    locked ||
    leaf === 'login' ||
    leaf === 'home' ||
    leaf === 'convite' ||
    leaf === 'cadastro-produtor';

  useEffect(() => {
    hideNativeSplash();
    const timer = setTimeout(() => setHeld(true), SPLASH_HOLD_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase === 'hold' && held && !loading && !producerLoading && destination) setPhase('darken');
  }, [destination, held, loading, phase, producerLoading]);

  useEffect(() => {
    if (!expoGo || phase !== 'darken' || fading.current) return;
    fading.current = true;
    Animated.timing(veil, {
      toValue: 1,
      duration: SPLASH_FADE_MS,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;
      setCover(false);
      Animated.timing(scene, {
        toValue: 1,
        duration: 720,
        useNativeDriver: true,
      }).start();
    });
  }, [phase, scene, veil]);

  return (
    <View style={styles.app}>
      <Animated.View style={[styles.scene, { opacity: scene }]}>{children}</Animated.View>
      {expoGo ? (
        <Modal
          visible={cover}
          transparent
          animationType="none"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={() => {}}
        >
          <View pointerEvents="auto" style={styles.opening}>
            <Image
              source={require('../assets/images/splash.png')}
              resizeMode="contain"
              fadeDuration={0}
              style={{ width: splashWidth, height: splashHeight, backgroundColor: '#000000' }}
            />
            <Animated.View pointerEvents="none" style={[styles.veil, { opacity: veil }]} />
          </View>
        </Modal>
      ) : null}
      {(expoGo ? !cover : held) ? <BiometricGate /> : null}
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
                <Stack.Screen name="home" options={{ animation: 'none' }} />
                <Stack.Screen name="compartilhados" />
                <Stack.Screen name="conta" />
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
  scene: {
    flex: 1,
  },
  opening: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#000000',
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
