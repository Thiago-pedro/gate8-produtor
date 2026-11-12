import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';

import {
  CACHE_TTL,
  __resetDataCacheForTests,
  cachedQuery,
  clearUserDataCache,
  createMemoryDisk,
  invalidateCachedData,
  peekCachedData,
  readCachedData,
  withTimeout,
  writeCachedData,
} from './data-cache.ts';

const USER = 'producer-1';
const OTHER = 'producer-2';

beforeEach(() => {
  __resetDataCacheForTests({
    disk: createMemoryDisk(),
    getUser: async () => ({ id: USER }),
  });
});

afterEach(() => {
  __resetDataCacheForTests({
    disk: createMemoryDisk(),
    getUser: async () => null,
  });
});

test('withTimeout resolve antes do limite', async () => {
  const value = await withTimeout(Promise.resolve(42), 200);
  assert.equal(value, 42);
});

test('withTimeout estoura quando a promise não resolve', async () => {
  await assert.rejects(
    () =>
      withTimeout(
        new Promise(() => {
          // nunca resolve
        }),
        30,
        'timeout-teste'
      ),
    /timeout-teste/
  );
});

test('write + peek + read na memória', async () => {
  await writeCachedData('finance:ev1', { net: 100 }, USER);
  assert.deepEqual(peekCachedData('finance:ev1', USER), { net: 100 });
  const read = await readCachedData<{ net: number }>('finance:ev1', USER);
  assert.ok(read);
  assert.equal(read.data.net, 100);
  assert.ok(read.ageMs >= 0);
});

test('peek sem userId retorna null', () => {
  assert.equal(peekCachedData('finance:ev1', null), null);
  assert.equal(peekCachedData('finance:ev1', undefined), null);
});

test('cache isola usuários', async () => {
  await writeCachedData('events-list', ['a'], USER);
  await writeCachedData('events-list', ['b'], OTHER);
  assert.deepEqual(peekCachedData('events-list', USER), ['a']);
  assert.deepEqual(peekCachedData('events-list', OTHER), ['b']);
});

test('invalidate remove memória e disco', async () => {
  await writeCachedData('sales-pulse:ev1', { soldToday: 3 }, USER);
  await invalidateCachedData('sales-pulse:ev1', USER);
  assert.equal(peekCachedData('sales-pulse:ev1', USER), null);
  assert.equal(await readCachedData('sales-pulse:ev1', USER), null);
});

test('clearUserDataCache limpa só o usuário', async () => {
  await writeCachedData('finance:1', { ok: true }, USER);
  await writeCachedData('finance:1', { ok: false }, OTHER);
  await clearUserDataCache(USER);
  assert.equal(peekCachedData('finance:1', USER), null);
  assert.deepEqual(peekCachedData('finance:1', OTHER), { ok: false });
});

test('cachedQuery busca na rede na primeira vez e grava cache', async () => {
  let calls = 0;
  const result = await cachedQuery(
    'finance:ev',
    async () => {
      calls += 1;
      return { net: 50 };
    },
    { userId: USER, ttlMs: 60_000 }
  );
  assert.equal(result.net, 50);
  assert.equal(calls, 1);
  assert.deepEqual(peekCachedData('finance:ev', USER), { net: 50 });
});

test('cachedQuery com cache fresco NÃO chama fetcher', async () => {
  await writeCachedData('finance:ev', { net: 10 }, USER);
  let calls = 0;
  const result = await cachedQuery(
    'finance:ev',
    async () => {
      calls += 1;
      return { net: 99 };
    },
    { userId: USER, ttlMs: 60_000 }
  );
  assert.equal(result.net, 10);
  assert.equal(calls, 0);
});

test('cachedQuery stale chama onCached e depois atualiza', async () => {
  const disk = createMemoryDisk();
  __resetDataCacheForTests({
    disk,
    getUser: async () => ({ id: USER }),
  });
  await disk.write(USER, {
    entries: {
      'finance:ev': { savedAt: Date.now() - 120_000, data: { net: 1 } },
    },
  });

  let calls = 0;
  let cachedSeen: { net: number } | null = null;
  const result = await cachedQuery(
    'finance:ev',
    async () => {
      calls += 1;
      return { net: 2 };
    },
    {
      userId: USER,
      ttlMs: 30_000,
      onCached: (data) => {
        cachedSeen = data;
      },
    }
  );

  assert.deepEqual(cachedSeen, { net: 1 });
  assert.equal(calls, 1);
  assert.equal(result.net, 2);
  assert.deepEqual(peekCachedData('finance:ev', USER), { net: 2 });
});

test('cachedQuery force ignora cache fresco', async () => {
  await writeCachedData('finance:ev', { net: 1 }, USER);
  let calls = 0;
  const result = await cachedQuery(
    'finance:ev',
    async () => {
      calls += 1;
      return { net: 7 };
    },
    { userId: USER, ttlMs: 60_000, force: true }
  );
  assert.equal(calls, 1);
  assert.equal(result.net, 7);
});

test('cachedQuery propaga timeout do fetcher lento', async () => {
  await assert.rejects(
    () =>
      cachedQuery(
        'finance:slow',
        () =>
          new Promise(() => {
            // hang
          }),
        { userId: USER, timeoutMs: 40, ttlMs: 1 }
      ),
    /demorou demais/
  );
});

test('read rehidrata memória a partir do disco', async () => {
  const disk = createMemoryDisk();
  await disk.write(USER, {
    entries: {
      'event-detail:1': { savedAt: Date.now(), data: { name: 'Festa' } },
    },
  });
  __resetDataCacheForTests({
    disk,
    getUser: async () => ({ id: USER }),
  });
  assert.equal(peekCachedData('event-detail:1', USER), null);
  const read = await readCachedData<{ name: string }>('event-detail:1', USER);
  assert.equal(read?.data.name, 'Festa');
  assert.deepEqual(peekCachedData('event-detail:1', USER), { name: 'Festa' });
});

test('TTLs exportados batem com a política do app', () => {
  assert.equal(CACHE_TTL.eventsList, 45_000);
  assert.equal(CACHE_TTL.eventDetail, 60_000);
  assert.equal(CACHE_TTL.finance, 60_000);
  assert.equal(CACHE_TTL.salesPulse, 45_000);
});

test('sem usuário autenticado não grava nem lê', async () => {
  __resetDataCacheForTests({
    disk: createMemoryDisk(),
    getUser: async () => null,
  });
  await writeCachedData('finance:ev', { net: 1 });
  assert.equal(await readCachedData('finance:ev'), null);
  let calls = 0;
  const value = await cachedQuery('finance:ev', async () => {
    calls += 1;
    return { net: 9 };
  });
  assert.equal(value.net, 9);
  assert.equal(calls, 1);
  // sem userId, não persiste
  assert.equal(peekCachedData('finance:ev', USER), null);
});
