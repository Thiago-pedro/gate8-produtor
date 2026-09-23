import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/lib/auth-context';
import { hasProducerProfile } from '@/lib/producer';

type ProducerStatus = 'idle' | 'loading' | 'producer' | 'guest';

type ProducerContextValue = {
  status: ProducerStatus;
  loading: boolean;
  isProducer: boolean;
  refresh: () => Promise<void>;
};

const ProducerContext = createContext<ProducerContextValue | null>(null);

export function ProducerProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<ProducerStatus>('idle');

  const refresh = useCallback(async () => {
    if (!user) {
      setStatus('idle');
      return;
    }
    setStatus('loading');
    try {
      setStatus((await hasProducerProfile(user.id)) ? 'producer' : 'guest');
    } catch {
      setStatus('guest');
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<ProducerContextValue>(
    () => ({
      status,
      loading: authLoading || (!!user && (status === 'idle' || status === 'loading')),
      isProducer: status === 'producer',
      refresh,
    }),
    [authLoading, refresh, status, user]
  );

  return <ProducerContext.Provider value={value}>{children}</ProducerContext.Provider>;
}

export function useProducer() {
  const context = useContext(ProducerContext);
  if (!context) {
    throw new Error('useProducer precisa estar dentro do ProducerProvider');
  }
  return context;
}
