import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';

export default function SplashIndex() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      router.replace(user ? '/home' : '/login');
    }, 1600);
    return () => clearTimeout(timer);
  }, [loading, router, user]);

  return (
    <View style={styles.splash}>
      <Image source={require('../assets/images/splash-8.png')} style={styles.eight} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eight: {
    width: 160,
    height: 160,
  },
});
