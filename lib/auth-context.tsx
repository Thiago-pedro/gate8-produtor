import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  restoreSession,
  signInWithPassword,
  signOut as signOutRequest,
  subscribeAuth,
  type AuthUser,
} from '@/lib/auth';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeAuth(setUser);
    restoreSession()
      .then(setUser)
      .finally(() => setLoading(false));
    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signIn: async (email, password) => {
        setUser(await signInWithPassword(email, password));
      },
      signOut: async () => {
        await signOutRequest();
        setUser(null);
      },
    }),
    [user, loading]
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
