import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  restoreSession,
  signInWithPassword,
  signOut as signOutRequest,
  signUpWithPassword,
  subscribeAuth,
  type AuthUser,
} from '@/lib/auth';
import { biometricsAvailable, confirmDeviceOwner, readBiometricPreference } from '@/lib/biometric';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  locked: boolean;
  unlock: () => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, cpf: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const pendingUser = useRef<AuthUser | null>(null);
  const suppress = useRef(false);

  const unlock = useCallback(async () => {
    const ok = await confirmDeviceOwner();
    if (!ok || !pendingUser.current) return false;
    setUser(pendingUser.current);
    setLocked(false);
    return true;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeAuth((next) => {
      if (suppress.current) return;
      if (!next) {
        pendingUser.current = null;
        setLocked(false);
      }
      setUser(next);
    });
    let cancelled = false;
    suppress.current = true;
    restoreSession()
      .then(async (restored) => {
        if (cancelled) return;
        if (!restored) {
          setUser(null);
          return;
        }
        const preference = await readBiometricPreference(restored.id);
        pendingUser.current = restored;
        setUser(restored);
        if (preference === 'on' && (await biometricsAvailable())) {
          setLocked(true);
        }
      })
      .finally(() => {
        suppress.current = false;
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      locked,
      unlock,
      signIn: async (email, password) => {
        setUser(await signInWithPassword(email, password));
      },
      signUp: async (email, password, name, cpf) => {
        const result = await signUpWithPassword(email, password, name, cpf);
        setUser(result.user);
        return { needsConfirmation: result.needsConfirmation };
      },
      signOut: async () => {
        pendingUser.current = null;
        setLocked(false);
        await signOutRequest();
        setUser(null);
      },
    }),
    [user, loading, locked, unlock]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth precisa estar dentro do AuthProvider');
  }
  return context;
}
