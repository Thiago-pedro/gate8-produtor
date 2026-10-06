import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { useProducer } from '@/lib/producer-context';

export default function SplashIndex() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { status, loading: producerLoading } = useProducer();

  useEffect(() => {
    if (loading || producerLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    router.replace(status === 'producer' ? '/home' : '/convite');
  }, [loading, producerLoading, router, status, user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!user) {
        router.replace('/login');
        return;
      }
      router.replace(status === 'guest' ? '/convite' : '/home');
    }, 5000);
    return () => clearTimeout(timer);
  }, [router, status, user]);

  return (
    <View style={styles.splash}>
      <Image source={require('../assets/images/splash.png')} style={styles.image} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#000000',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
});
