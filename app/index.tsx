import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

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
    if (status === 'producer') {
      router.replace('/home');
      return;
    }
    if (status === 'guest') router.replace('/convite');
  }, [loading, producerLoading, router, status, user]);

  return <View style={styles.splash} />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
