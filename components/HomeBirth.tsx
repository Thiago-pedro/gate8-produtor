import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const BIRTH_MS = 300;
let homeIntroPlayed = false;

/** Véu preto que some ao entrar na tela — igual o app cliente. */
export function HomeBirth() {
  const veil = useSharedValue(1);
  const [live, setLive] = useState(() => {
    if (homeIntroPlayed) return false;
    homeIntroPlayed = true;
    return true;
  });
  const style = useAnimatedStyle(() => ({ opacity: veil.value }));

  useEffect(() => {
    if (!live) return;
    veil.value = withTiming(0, { duration: BIRTH_MS, easing: Easing.out(Easing.cubic) });
    const timer = setTimeout(() => setLive(false), BIRTH_MS);
    return () => clearTimeout(timer);
  }, [live, veil]);

  if (!live) return null;
  return <Animated.View pointerEvents="none" style={[styles.birth, style]} />;
}

const styles = StyleSheet.create({
  birth: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 80,
    elevation: 80,
    backgroundColor: '#000000',
  },
});
