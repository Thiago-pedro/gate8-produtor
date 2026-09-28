import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { colors } from '@/constants/theme';

function channels(hex: string) {
  const value = hex.replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgba(hex: string, alpha: number) {
  const { r, g, b } = channels(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function mix(hex: string, toward: number, amount: number) {
  const { r, g, b } = channels(hex);
  const next = (c: number) => Math.round(c + (toward - c) * amount);
  return `#${[next(r), next(g), next(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export function NeonCard({
  children,
  contentStyle,
  accent = colors.blue,
}: {
  children: ReactNode;
  contentStyle?: ViewStyle;
  accent?: string;
}) {
  const glow = rgba(accent, 0.45);
  const glowSoft = rgba(accent, 0.08);
  const glowMid = rgba(accent, 0.32);
  const haze = rgba(accent, 0.16);
  const light = mix(accent, 255, 0.32);
  const dark = mix(accent, 0, 0.32);

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={[glow, glowSoft, glowMid]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.outerGlow}
      />
      <View style={[styles.midGlow, { backgroundColor: haze }]} />
      <View style={[styles.shadow, { shadowColor: accent }]}>
        <LinearGradient
          colors={[light, accent, dark, accent, light]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.border}
        >
          <View style={[styles.inner, contentStyle]}>{children}</View>
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    overflow: 'visible',
  },
  outerGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 28,
    transform: [{ scale: 1.06 }],
    opacity: 0.9,
  },
  midGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 24,
    transform: [{ scale: 1.03 }],
  },
  shadow: {
    shadowOpacity: 0.85,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 18,
  },
  border: {
    borderRadius: 22,
    padding: 1.6,
  },
  inner: {
    backgroundColor: '#071525',
    borderRadius: 20.5,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
  },
});
