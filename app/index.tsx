import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useProducer } from '@/lib/producer-context';

export default function SplashIndex() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { status, loading: producerLoading } = useProducer();

  useEffect(() => {
    if (loading || producerLoading) return;
    const timer = setTimeout(() => {
      if (!user) {
        router.replace('/login');
        return;
      }
      router.replace(status === 'producer' ? '/home' : '/convite');
    }, 1600);
    return () => clearTimeout(timer);
  }, [loading, producerLoading, router, status, user]);

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
