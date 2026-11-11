import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Image, StyleSheet, View } from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { useErrorNotice } from '@/lib/error-notice';
import { useProducer } from '@/lib/producer-context';
import { markSplashFinished } from '@/lib/splash-ready';
import { fetchSharedMenu } from '@/lib/team';

const splashSource = require('../assets/images/splash.png') as number;
const expoGo = Constants.expoGoConfig != null || Constants.appOwnership === 'expo';
const screen = Dimensions.get('screen');
const SPLASH_MS = 1600;
const DARKEN_MS = 280;
let splashDone = false;

export default function SplashIndex() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { status, loading: producerLoading } = useProducer();
  const { showError } = useErrorNotice();
  const opened = useRef(false);
  const dimming = useRef(false);
  const dim = useRef(new Animated.Value(0)).current;
  const [canLeave, setCanLeave] = useState(false);

  const openApp = useCallback(() => {
    if (opened.current) return;
    opened.current = true;
    markSplashFinished();
    splashDone = true;
    setCanLeave(true);
  }, []);

  const darken = useCallback(() => {
    if (dimming.current || opened.current) return;
    dimming.current = true;
    Animated.timing(dim, {
      toValue: 1,
      duration: DARKEN_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) openApp();
    });
  }, [dim, openApp]);

  useEffect(() => {
    if (expoGo) return;
    if (splashDone) openApp();
  }, [openApp]);

  useEffect(() => {
    const enter = setTimeout(darken, SPLASH_MS);
    const backup = setTimeout(openApp, 8000);
    return () => {
      clearTimeout(enter);
      clearTimeout(backup);
    };
  }, [darken, openApp]);

  useEffect(() => {
    if (!canLeave || loading || producerLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (status === 'producer') {
      router.replace('/home');
      return;
    }
    if (status !== 'guest') return;
    let alive = true;
    void fetchSharedMenu(user.id, user.email)
      .then((menu) => {
        if (!alive) return;
        router.replace(menu.visible ? '/compartilhados' : '/convite');
      })
      .catch((caught) => {
        if (!alive) return;
        showError(caught instanceof Error ? caught.message : 'Não foi possível abrir o menu compartilhado.');
        router.replace('/convite');
      });
    return () => {
      alive = false;
    };
  }, [canLeave, loading, producerLoading, router, showError, status, user]);

  return (
    <View style={styles.hold}>
      <Image
        source={splashSource}
        resizeMode="contain"
        fadeDuration={0}
        onLoadEnd={() => {
          void SplashScreen.hideAsync().catch(() => undefined);
        }}
        onError={() => openApp()}
        style={styles.art}
      />
      <Animated.View pointerEvents="none" style={[styles.dim, { opacity: dim }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hold: {
    width: screen.width,
    height: screen.height,
    backgroundColor: '#000000',
  },
  art: {
    width: screen.width,
    height: screen.height,
  },
  dim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#000000',
  },
});
