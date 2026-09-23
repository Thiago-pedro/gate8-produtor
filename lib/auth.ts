import * as SecureStore from 'expo-secure-store';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/config';

const SESSION_KEY = 'gate8.produtor.session';

export type AuthUser = {
  id: string;
  email: string | null;
  name: string | null;
};

type Session = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

type AuthListener = (user: AuthUser | null) => void;

let memorySession: Session | null = null;
const listeners = new Set<AuthListener>();

const storeOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export function subscribeAuth(listener: AuthListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitAuth(user: AuthUser | null) {
  for (const listener of listeners) listener(user);
}

export async function getAccessToken() {
  const session = await readSession();
  return session?.accessToken ?? null;
}

function authHeaders(accessToken?: string) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken ?? SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

function mapAuthError(message?: string) {
  const text = (message ?? '').toLowerCase();
  if (text.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (text.includes('email not confirmed')) return 'Confirme seu e-mail para entrar.';
  if (text.includes('already registered') || text.includes('user already')) {
    return 'Este e-mail já tem uma conta. Entre com e-mail e senha.';
  }
  if (text.includes('rate limit')) return 'Muitas tentativas. Espere um pouco e tente de novo.';
  return message || 'Não foi possível entrar. Tente de novo.';
}

function toUser(raw: {
  id?: string;
  email?: string | null;
  user_metadata?: { full_name?: string; name?: string };
}): AuthUser {
  return {
    id: raw.id ?? '',
    email: raw.email ?? null,
    name: raw.user_metadata?.full_name || raw.user_metadata?.name || null,
  };
}

async function saveSession(session: Session) {
  memorySession = session;
  emitAuth(session.user);
  try {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), storeOptions);
  } catch {
    // Expo Go / web can fail here; session still lives in memory.
  }
}

async function readSession(): Promise<Session | null> {
  if (memorySession) return memorySession;
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY, storeOptions);
    if (!raw) return null;
    memorySession = JSON.parse(raw) as Session;
    return memorySession;
  } catch {
    return null;
  }
}

async function clearSession() {
  memorySession = null;
  emitAuth(null);
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY, storeOptions);
  } catch {
    // ignore
  }
}

async function parseAuthResponse(response: Response) {
  const body = (await response.json().catch(() => ({}))) as {
    msg?: string;
    error_description?: string;
    error?: string;
    message?: string;
    access_token?: string;
    refresh_token?: string;
    user?: {
      id?: string;
      email?: string | null;
      user_metadata?: { full_name?: string; name?: string };
    };
  };

  if (!response.ok || !body.access_token || !body.user) {
    throw new Error(
      mapAuthError(body.msg || body.error_description || body.message || body.error)
    );
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? '',
    user: toUser(body.user),
  } satisfies Session;
}

export async function signInWithPassword(email: string, password: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const session = await parseAuthResponse(response);
  await saveSession(session);
  return session.user;
}

export async function signUpWithPassword(email: string, password: string, name: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      email: email.trim(),
      password,
      data: { full_name: name.trim() },
    }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    msg?: string;
    error_description?: string;
    message?: string;
    error?: string;
    access_token?: string;
    refresh_token?: string;
    user?: {
      id?: string;
      email?: string | null;
      user_metadata?: { full_name?: string; name?: string };
    };
    identities?: unknown[];
  };

  if (!response.ok) {
    throw new Error(mapAuthError(body.msg || body.error_description || body.message || body.error));
  }

  if (body.identities && body.identities.length === 0) {
    throw new Error('Este e-mail já tem uma conta. Entre com e-mail e senha.');
  }

  if (body.access_token && body.user) {
    const session = {
      accessToken: body.access_token,
      refreshToken: body.refresh_token ?? '',
      user: toUser(body.user),
    };
    await saveSession(session);
    return { user: session.user, needsConfirmation: false };
  }

  return { user: null, needsConfirmation: true };
}

async function fetchUser(accessToken: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: authHeaders(accessToken),
  });
  const body = (await response.json().catch(() => ({}))) as {
    id?: string;
    email?: string | null;
    user_metadata?: { full_name?: string; name?: string };
    msg?: string;
    message?: string;
  };
  if (!response.ok || !body.id) {
    throw new Error(mapAuthError(body.msg || body.message));
  }
  return toUser(body);
}

export async function restoreSession() {
  const stored = await readSession();
  if (!stored?.accessToken) return null;

  try {
    const user = await fetchUser(stored.accessToken);
    const next = { ...stored, user };
    await saveSession(next);
    return user;
  } catch {
    if (!stored.refreshToken) {
      await clearSession();
      return null;
    }

    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ refresh_token: stored.refreshToken }),
    });

    try {
      const session = await parseAuthResponse(response);
      await saveSession(session);
      return session.user;
    } catch {
      await clearSession();
      return null;
    }
  }
}

export async function signOut() {
  const stored = await readSession();
  if (stored?.accessToken) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: authHeaders(stored.accessToken),
    }).catch(() => undefined);
  }
  await clearSession();
}
