import { getAccessToken } from '@/lib/auth';
import { siteUrl } from '@/constants/theme';

type Node = {
  t?: number;
  i?: number;
  s?: unknown;
  p?: { k?: string[]; v?: Node[] };
  a?: Node[];
  o?: number;
  c?: unknown;
};

function encodeValue(value: unknown, next: { i: number }): Node {
  if (typeof value === 'number') return { t: 0, s: value };
  if (typeof value === 'string') return { t: 1, s: value };
  if (typeof value === 'boolean') return { t: 2, s: value ? 3 : 2 };
  if (value === null) return { t: 2, s: 0 };
  if (value === undefined) return { t: 2, s: 1 };
  if (Array.isArray(value)) {
    const i = next.i++;
    return { t: 9, i, a: value.map((item) => encodeValue(item, next)), o: 0 };
  }
  if (typeof value === 'object') {
    const i = next.i++;
    const keys = Object.keys(value as Record<string, unknown>).filter(
      (key) => (value as Record<string, unknown>)[key] !== undefined
    );
    return {
      t: 10,
      i,
      p: {
        k: keys,
        v: keys.map((key) => encodeValue((value as Record<string, unknown>)[key], next)),
      },
      o: 0,
    };
  }
  return { t: 2, s: 1 };
}

function wrap(data: unknown) {
  return { t: encodeValue({ data }, { i: 0 }), f: 63, m: [] };
}

function decodeValue(node: unknown): unknown {
  if (!node || typeof node !== 'object') return node;
  const item = node as Node;
  if (typeof item.t !== 'number') return node;

  switch (item.t) {
    case 0:
    case 1:
      return item.s;
    case 2:
      if (item.s === 0) return null;
      if (item.s === 1) return undefined;
      if (item.s === 2) return false;
      if (item.s === 3) return true;
      return item.s;
    case 9:
      return (item.a ?? []).map(decodeValue);
    case 10:
    case 11: {
      const keys = item.p?.k ?? [];
      const values = item.p?.v ?? [];
      const out: Record<string, unknown> = {};
      keys.forEach((key, index) => {
        out[key] = decodeValue(values[index]);
      });
      return out;
    }
    case 25: {
      const message = decodeValue((item.s as { message?: unknown })?.message);
      throw new Error(typeof message === 'string' ? message : 'Falha ao falar com o servidor.');
    }
    default:
      if (item.s != null) return decodeValue(item.s);
      return node;
  }
}

function unwrap(decoded: unknown) {
  if (decoded && typeof decoded === 'object' && 'result' in decoded) {
    const envelope = decoded as { result?: unknown; error?: unknown };
    if (envelope.error instanceof Error) throw envelope.error;
    if (envelope.error && typeof envelope.error === 'object') {
      const message = (envelope.error as { message?: unknown }).message;
      if (typeof message === 'string' && message) throw new Error(message);
    }
    if (typeof envelope.error === 'string' && envelope.error) throw new Error(envelope.error);
    return envelope.result;
  }
  return decoded;
}

function errorFromBody(raw: unknown, status: number, text: string) {
  if (raw && typeof raw === 'object') {
    const body = raw as { error?: unknown; message?: unknown; msg?: unknown };
    const nested =
      typeof body.error === 'object' && body.error
        ? (body.error as { message?: unknown }).message
        : body.error;
    const message = nested || body.message || body.msg;
    if (typeof message === 'string' && message.trim()) return new Error(message);
  }
  if (status === 401 || status === 403) return new Error('Faça login para continuar.');
  if (text && !text.startsWith('{') && !text.startsWith('<') && text.length < 220) {
    return new Error(text);
  }
  return new Error('Não foi possível carregar os dados financeiros.');
}

export async function callServerFn<T>(
  id: string,
  data: unknown,
  options?: { method?: 'GET' | 'POST'; auth?: boolean }
): Promise<T> {
  const method = options?.method ?? 'POST';
  const payload = JSON.stringify(wrap(data));
  const headers: Record<string, string> = {
    'x-tsr-serverFn': 'true',
    accept: 'application/json, application/x-ndjson',
    origin: siteUrl,
  };

  if (options?.auth !== false) {
    const token = await getAccessToken();
    if (!token) throw new Error('Faça login para continuar.');
    headers.Authorization = `Bearer ${token}`;
  }

  let url = `${siteUrl}/_serverFn/${id}`;
  const init: RequestInit = { method, headers };

  if (method === 'GET') {
    url += `?payload=${encodeURIComponent(payload)}`;
  } else {
    headers['content-type'] = 'application/json';
    init.body = payload;
  }

  const response = await fetch(url, init);
  const text = await response.text();
  let raw: unknown = text;
  try {
    raw = JSON.parse(text);
  } catch {
    throw errorFromBody(null, response.status, text);
  }

  const decoded = unwrap(decodeValue(raw));
  if (!response.ok) throw errorFromBody(decoded, response.status, text);
  return decoded as T;
}
