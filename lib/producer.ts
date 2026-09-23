import { getAccessToken } from '@/lib/auth';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/config';

export type ProducerKind = 'individual' | 'company';

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';

export type BankAccountKind = '' | 'checking' | 'savings' | 'payment';

export type ClientProfile = {
  full_name: string;
  cpf: string;
  phone: string;
  city: string;
  state: string;
  birth_date: string;
};

export type ProducerDraft = {
  kind: ProducerKind;
  full_name: string;
  brand_name: string;
  phone: string;
  whatsapp: string;
  email: string;
  city: string;
  state: string;
  bio: string;
  cpf: string;
  birth_date: string;
  cnpj: string;
  legal_name: string;
  trade_name: string;
  pix_key: string;
  pix_key_type: PixKeyType;
  bank_name: string;
  bank_agency: string;
  bank_account: string;
  bank_account_kind: BankAccountKind;
};

const emptyDraft: ProducerDraft = {
  kind: 'individual',
  full_name: '',
  brand_name: '',
  phone: '',
  whatsapp: '',
  email: '',
  city: '',
  state: '',
  bio: '',
  cpf: '',
  birth_date: '',
  cnpj: '',
  legal_name: '',
  trade_name: '',
  pix_key: '',
  pix_key_type: 'cpf',
  bank_name: '',
  bank_agency: '',
  bank_account: '',
  bank_account_kind: '',
};

async function producerHeaders() {
  const token = await getAccessToken();
  if (!token) throw new Error('Entre na conta para continuar.');
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...(await producerHeaders()),
      ...(init?.headers ?? {}),
    },
  });
  const raw = await response.text();
  const body = raw ? (JSON.parse(raw) as unknown) : null;
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && body !== null && 'message' in body
        ? String((body as { message?: string }).message)
        : null;
    throw new Error(message || 'Não foi possível falar com o painel do produtor.');
  }
  return body as T;
}

function text(row: Record<string, unknown> | null, key: string) {
  const value = row?.[key];
  return value == null ? '' : String(value);
}

export async function hasProducerProfile(userId: string) {
  const rows = await rest<{ id: string }[]>(
    `producer_profiles?select=id&user_id=eq.${encodeURIComponent(userId)}`
  );
  return Array.isArray(rows) && rows.length > 0;
}

export async function fetchClientProfile(userId: string): Promise<ClientProfile> {
  const rows = await rest<Record<string, unknown>[]>(
    `profiles?select=full_name,cpf,phone,city,state,birth_date&id=eq.${encodeURIComponent(userId)}`
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  return {
    full_name: text(row, 'full_name'),
    cpf: text(row, 'cpf'),
    phone: text(row, 'phone'),
    city: text(row, 'city'),
    state: text(row, 'state'),
    birth_date: text(row, 'birth_date'),
  };
}

export async function buildProducerDraft(user: {
  id: string;
  email: string | null;
  name: string | null;
}): Promise<ProducerDraft> {
  const client = await fetchClientProfile(user.id).catch(() => ({
    full_name: '',
    cpf: '',
    phone: '',
    city: '',
    state: '',
    birth_date: '',
  }));

  return {
    ...emptyDraft,
    email: user.email ?? '',
    full_name: client.full_name || user.name || '',
    phone: client.phone,
    whatsapp: client.phone,
    city: client.city,
    state: client.state,
    cpf: client.cpf,
    birth_date: client.birth_date,
  };
}

export async function saveProducerProfile(userId: string, draft: ProducerDraft) {
  const payload = {
    user_id: userId,
    kind: draft.kind,
    full_name: draft.full_name || null,
    brand_name: draft.brand_name || null,
    phone: draft.phone || null,
    whatsapp: draft.whatsapp || null,
    email: draft.email || null,
    city: draft.city || null,
    state: draft.state || null,
    bio: draft.bio || null,
    cpf: draft.kind === 'individual' && draft.cpf ? draft.cpf : null,
    birth_date: draft.kind === 'individual' && draft.birth_date ? draft.birth_date : null,
    cnpj: draft.kind === 'company' && draft.cnpj ? draft.cnpj : null,
    legal_name: draft.kind === 'company' && draft.legal_name ? draft.legal_name : null,
    trade_name: draft.kind === 'company' && draft.trade_name ? draft.trade_name : null,
    pix_key: draft.pix_key || null,
    bank_name: draft.bank_name || null,
    bank_agency: draft.bank_agency || null,
    bank_account: draft.bank_account || null,
    bank_account_kind: draft.bank_account_kind || null,
  };

  await rest(`producer_profiles?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(payload),
  });
}

export function digits(value: string, max: number) {
  return value.replace(/\D/g, '').slice(0, max);
}

export function formatCpf(value: string) {
  return digits(value, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function formatCnpj(value: string) {
  return digits(value, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function formatPhone(value: string) {
  const raw = digits(value, 11);
  if (raw.length <= 10) {
    return raw.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
  }
  return raw.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
}

export function formatPixKey(value: string, type: PixKeyType) {
  if (type === 'cpf') return formatCpf(value);
  if (type === 'cnpj') return formatCnpj(value);
  if (type === 'phone') return formatPhone(value);
  if (type === 'email') return value.slice(0, 254);
  return value.slice(0, 80);
}
