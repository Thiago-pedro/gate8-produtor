import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { useErrorNotice } from '@/lib/error-notice';
import { useProducer } from '@/lib/producer-context';
import { fetchSharedMenu } from '@/lib/team';

export default function SplashIndex() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { status, loading: producerLoading } = useProducer();
  const { showError } = useErrorNotice();

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
  }, [loading, producerLoading, router, showError, status, user]);

  return <View style={styles.splash} />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
