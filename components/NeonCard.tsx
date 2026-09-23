import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { colors } from '@/constants/theme';

export function NeonCard({ children, contentStyle }: { children: ReactNode; contentStyle?: ViewStyle }) {
  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['rgba(0,123,255,0.45)', 'rgba(0,123,255,0.08)', 'rgba(0,123,255,0.32)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.outerGlow}
      />
      <View style={styles.midGlow} />
      <View style={styles.shadow}>
        <LinearGradient
          colors={['#4da3ff', '#007BFF', '#0056b3', '#007BFF', '#4da3ff']}
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
    backgroundColor: 'rgba(0, 123, 255, 0.16)',
    transform: [{ scale: 1.03 }],
  },
  shadow: {
    shadowColor: colors.blue,
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
