/** TTL “fresco”: dentro disso não bate na rede de novo. */
export const CACHE_TTL = {
  eventsList: 45_000,
  eventDetail: 60_000,
  finance: 60_000,
  salesPulse: 45_000,
} as const;

const FETCH_TIMEOUT_MS = 45_000;

type CacheRecord = { savedAt: number; data: unknown };
type DiskStore = { entries: Record<string, CacheRecord> };

export type DataCacheDisk = {
  read(userId: string): Promise<DiskStore>;
  write(userId: string, store: DiskStore): Promise<void>;
  clear(userId: string): Promise<void>;
};

const memory = new Map<string, CacheRecord>();

function scopeKey(userId: string, key: string) {
  return `${userId}::${key}`;
}

async function resolveAuthUser() {
  try {
    const { getAuthUser } = await import('@/lib/auth');
    return await getAuthUser();
  } catch {
    return null;
  }
}

async function storeFile(userId: string) {
  const { File, Paths } = await import('expo-file-system');
  return new File(Paths.document, `gate8-produtor-cache-${userId}.json`);
}

const fileDisk: DataCacheDisk = {
  async read(userId) {
    try {
      const file = await storeFile(userId);
      if (!file.exists) return { entries: {} };
      const parsed = (await file.json()) as DiskStore;
      if (!parsed || typeof parsed !== 'object' || !parsed.entries) return { entries: {} };
      return parsed;
    } catch {
      return { entries: {} };
    }
  },
  async write(userId, store) {
    try {
      const file = await storeFile(userId);
      if (!file.exists) file.create();
      file.write(JSON.stringify(store));
    } catch {
      // cache em disco é best-effort
    }
  },
  async clear(userId) {
    try {
      const file = await storeFile(userId);
      if (file.exists) file.delete();
    } catch {
      // ignore
    }
  },
};

let disk: DataCacheDisk = fileDisk;
let authUserResolver: () => Promise<{ id: string } | null> = resolveAuthUser;

/** Só para testes: troca disco/auth e limpa memória. */
export function __resetDataCacheForTests(options?: {
  disk?: DataCacheDisk;
  getUser?: () => Promise<{ id: string } | null>;
}) {
  memory.clear();
  disk = options?.disk ?? fileDisk;
  authUserResolver = options?.getUser ?? resolveAuthUser;
}

export function createMemoryDisk(): DataCacheDisk {
  const stores = new Map<string, DiskStore>();
  return {
    async read(userId) {
      return stores.get(userId) ?? { entries: {} };
    },
    async write(userId, store) {
      stores.set(userId, {
        entries: { ...store.entries },
      });
    },
    async clear(userId) {
      stores.delete(userId);
    },
  };
}

async function resolveUser(userId?: string | null) {
  if (userId) return { id: userId };
  return authUserResolver();
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms = FETCH_TIMEOUT_MS,
  message = 'A consulta demorou demais. Puxe para atualizar.'
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Leitura síncrona da memória (abertura instantânea da tela). */
export function peekCachedData<T>(key: string, userId?: string | null): T | null {
  if (!userId) return null;
  const hit = memory.get(scopeKey(userId, key));
  return hit ? (hit.data as T) : null;
}

export async function readCachedData<T>(
  key: string,
  userId?: string | null
): Promise<{ data: T; ageMs: number; savedAt: number } | null> {
  const user = await resolveUser(userId);
  if (!user?.id) return null;
  const scoped = scopeKey(user.id, key);
  const mem = memory.get(scoped);
  if (mem) {
    return { data: mem.data as T, ageMs: Date.now() - mem.savedAt, savedAt: mem.savedAt };
  }
  const store = await disk.read(user.id);
  const diskHit = store.entries[key];
  if (!diskHit) return null;
  memory.set(scoped, diskHit);
  return { data: diskHit.data as T, ageMs: Date.now() - diskHit.savedAt, savedAt: diskHit.savedAt };
}

export async function writeCachedData<T>(key: string, data: T, userId?: string | null) {
  const user = await resolveUser(userId);
  if (!user?.id) return;
  const record: CacheRecord = { savedAt: Date.now(), data };
  memory.set(scopeKey(user.id, key), record);
  const store = await disk.read(user.id);
  store.entries[key] = record;
  await disk.write(user.id, store);
}

export async function invalidateCachedData(key: string, userId?: string | null) {
  const user = await resolveUser(userId);
  if (!user?.id) return;
  memory.delete(scopeKey(user.id, key));
  const store = await disk.read(user.id);
  if (!(key in store.entries)) return;
  delete store.entries[key];
  await disk.write(user.id, store);
}

/** Limpa todo o cache do usuário (logout). */
export async function clearUserDataCache(userId?: string | null) {
  const user = await resolveUser(userId);
  if (!user?.id) {
    memory.clear();
    return;
  }
  const prefix = `${user.id}::`;
  for (const mapKey of [...memory.keys()]) {
    if (mapKey.startsWith(prefix)) memory.delete(mapKey);
  }
  await disk.clear(user.id);
}

/**
 * Stale-while-revalidate:
 * - cache fresco → devolve sem rede
 * - cache velho → `onCached` na hora + busca na rede
 * - sem cache → busca (com timeout)
 */
export async function cachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts?: {
    ttlMs?: number;
    force?: boolean;
    timeoutMs?: number;
    userId?: string | null;
    onCached?: (data: T) => void;
  }
): Promise<T> {
  const ttl = opts?.ttlMs ?? 60_000;
  const cached = opts?.force ? null : await readCachedData<T>(key, opts?.userId);
  if (cached) {
    opts?.onCached?.(cached.data);
    if (cached.ageMs < ttl) return cached.data;
  }
  const data = await withTimeout(fetcher(), opts?.timeoutMs ?? FETCH_TIMEOUT_MS);
  await writeCachedData(key, data, opts?.userId);
  return data;
}
