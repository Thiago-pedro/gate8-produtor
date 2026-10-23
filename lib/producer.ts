import * as FileSystem from 'expo-file-system/legacy';

import { getAccessToken } from '@/lib/auth';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/config';
import { callServerFn } from '@/lib/server-fn';

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
  instagram: string;
  facebook: string;
  logo_url: string;
  cpf: string;
  birth_date: string;
  cnpj: string;
  legal_name: string;
  trade_name: string;
  company_email: string;
  company_cep: string;
  company_street: string;
  company_number: string;
  company_complement: string;
  company_neighborhood: string;
  company_city: string;
  company_state: string;
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
  instagram: '',
  facebook: '',
  logo_url: '',
  cpf: '',
  birth_date: '',
  cnpj: '',
  legal_name: '',
  trade_name: '',
  company_email: '',
  company_cep: '',
  company_street: '',
  company_number: '',
  company_complement: '',
  company_neighborhood: '',
  company_city: '',
  company_state: '',
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

function greetingName(value: string) {
  const cleaned = value.trim();
  if (!cleaned || cleaned.includes('@')) return '';
  return cleaned.split(/\s+/)[0] ?? '';
}

export async function fetchProducerFirstName(userId: string) {
  const id = encodeURIComponent(userId);
  let producer: Record<string, unknown> | null = null;
  try {
    const rows = await rest<Record<string, unknown>[]>(
      `producer_profiles?select=kind,full_name,brand_name,trade_name&user_id=eq.${id}&limit=1`
    );
    producer = Array.isArray(rows) ? (rows[0] ?? null) : null;
  } catch {
    producer = null;
  }

  let profileName = '';
  try {
    const rows = await rest<Record<string, unknown>[]>(
      `profiles?select=full_name&id=eq.${id}&limit=1`
    );
    profileName = text(Array.isArray(rows) ? (rows[0] ?? null) : null, 'full_name');
  } catch {
    profileName = '';
  }

  const kind = text(producer, 'kind');
  const candidates = [
    text(producer, 'full_name'),
    profileName,
    kind === 'company' ? text(producer, 'trade_name') : text(producer, 'brand_name'),
  ];
  for (const candidate of candidates) {
    const name = greetingName(candidate);
    if (name) return name;
  }
  return '';
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

const FN_PRODUCER_VERIFY = 'ef11c55be3dd582a8de68d7735993265c20858b4f306201cbd00af6e73541175';
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const INSTAGRAM = /^(?:@?[a-zA-Z0-9._]{1,30}|https:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9._/-]+\/?)$/;
const FACEBOOK = /^(?:@?[a-zA-Z0-9.]{1,80}|https:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9._/-]+\/?)$/;

function asKind(value: string): ProducerKind {
  return value === 'company' ? 'company' : 'individual';
}

function asPixType(value: string): PixKeyType {
  if (value === 'cnpj' || value === 'email' || value === 'phone' || value === 'random') return value;
  return 'cpf';
}

function asAccountKind(value: string): BankAccountKind {
  if (value === 'checking' || value === 'savings' || value === 'payment') return value;
  return '';
}

export async function fetchProducerAccount(userId: string): Promise<ProducerDraft> {
  const rows = await rest<Record<string, unknown>[]>(
    `producer_profiles?select=*&user_id=eq.${encodeURIComponent(userId)}&limit=1`
  );
  const row = Array.isArray(rows) ? (rows[0] ?? null) : null;
  if (!row) throw new Error('Não encontramos o cadastro de produtor.');
  return {
    kind: asKind(text(row, 'kind')),
    full_name: text(row, 'full_name'),
    brand_name: text(row, 'brand_name'),
    phone: formatPhone(text(row, 'phone')),
    whatsapp: formatPhone(text(row, 'whatsapp')),
    email: text(row, 'email'),
    city: text(row, 'city'),
    state: text(row, 'state'),
    bio: text(row, 'bio'),
    instagram: text(row, 'instagram'),
    facebook: text(row, 'facebook'),
    logo_url: text(row, 'logo_url'),
    cpf: formatCpf(text(row, 'cpf')),
    birth_date: text(row, 'birth_date').slice(0, 10),
    cnpj: formatCnpj(text(row, 'cnpj')),
    legal_name: text(row, 'legal_name'),
    trade_name: text(row, 'trade_name'),
    company_email: text(row, 'company_email'),
    company_cep: formatCep(text(row, 'company_cep')),
    company_street: text(row, 'company_street'),
    company_number: text(row, 'company_number'),
    company_complement: text(row, 'company_complement'),
    company_neighborhood: text(row, 'company_neighborhood'),
    company_city: text(row, 'company_city'),
    company_state: text(row, 'company_state'),
    pix_key: formatPixKey(text(row, 'pix_key'), asPixType(text(row, 'pix_key_type'))),
    pix_key_type: asPixType(text(row, 'pix_key_type')),
    bank_name: text(row, 'bank_name'),
    bank_agency: text(row, 'bank_agency'),
    bank_account: text(row, 'bank_account'),
    bank_account_kind: asAccountKind(text(row, 'bank_account_kind')),
  };
}

export function producerAccountError(draft: ProducerDraft) {
  if (!draft.instagram.trim() && !draft.facebook.trim()) {
    return 'Informe o Instagram ou o Facebook.';
  }
  if (draft.instagram.trim() && !INSTAGRAM.test(draft.instagram.trim())) {
    return 'Informe um usuário ou link válido do Instagram.';
  }
  if (draft.facebook.trim() && !FACEBOOK.test(draft.facebook.trim())) {
    return 'Informe um usuário ou link válido do Facebook.';
  }
  if (draft.kind !== 'company') return null;
  if (!draft.cnpj.trim()) return 'Informe o CNPJ.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.company_email.trim())) {
    return 'Informe um e-mail válido da empresa.';
  }
  if (digits(draft.company_cep, 8).length !== 8) return 'Informe um CEP válido da empresa.';
  if (!draft.company_street.trim()) return 'Informe o endereço da empresa.';
  if (!draft.company_number.trim()) return 'Informe o número do endereço da empresa.';
  if (!draft.company_neighborhood.trim()) return 'Informe o bairro da empresa.';
  if (!draft.company_city.trim()) return 'Informe a cidade da empresa.';
  if (!/^[A-Z]{2}$/.test(draft.company_state.trim().toUpperCase())) {
    return 'Informe o estado da empresa com 2 letras.';
  }
  return null;
}

export async function updateProducerAccount(userId: string, draft: ProducerDraft) {
  const company = draft.kind === 'company';
  const payload = {
    user_id: userId,
    kind: draft.kind,
    full_name: draft.full_name || null,
    brand_name: draft.brand_name || null,
    instagram: draft.instagram.trim() || null,
    facebook: draft.facebook.trim() || null,
    logo_url: draft.logo_url || null,
    phone: draft.phone || null,
    whatsapp: draft.whatsapp || null,
    email: draft.email || null,
    city: draft.city || null,
    state: draft.state || null,
    bio: draft.bio || null,
    cpf: draft.kind === 'individual' && draft.cpf ? draft.cpf : null,
    birth_date: draft.kind === 'individual' && draft.birth_date ? draft.birth_date : null,
    cnpj: company && draft.cnpj ? draft.cnpj : null,
    legal_name: company && draft.legal_name ? draft.legal_name : null,
    trade_name: company && draft.trade_name ? draft.trade_name : null,
    company_email: company && draft.company_email.trim() ? draft.company_email.trim().toLowerCase() : null,
    company_cep: company && draft.company_cep ? draft.company_cep : null,
    company_street: company && draft.company_street.trim() ? draft.company_street.trim() : null,
    company_number: company && draft.company_number.trim() ? draft.company_number.trim() : null,
    company_complement: company && draft.company_complement.trim() ? draft.company_complement.trim() : null,
    company_neighborhood: company && draft.company_neighborhood.trim() ? draft.company_neighborhood.trim() : null,
    company_city: company && draft.company_city.trim() ? draft.company_city.trim() : null,
    company_state: company && draft.company_state.trim() ? draft.company_state.trim().toUpperCase() : null,
    pix_key: draft.pix_key || null,
    pix_key_type: draft.pix_key_type || null,
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

  try {
    const raw = await callServerFn<Record<string, unknown>>(FN_PRODUCER_VERIFY, {});
    const already = raw.alreadyVerified === true || raw.already_verified === true;
    const recipient = text(raw, 'recipient');
    return {
      alreadyVerified: already,
      recipient,
      message: already
        ? 'Cadastro de produtor salvo.'
        : `Cadastro salvo. Enviamos um link de confirmação para ${recipient || 'o e-mail da conta'}.`,
    };
  } catch {
    return {
      alreadyVerified: true,
      recipient: '',
      message: 'Cadastro salvo, mas não foi possível enviar o e-mail de verificação. Tente salvar de novo.',
    };
  }
}

export async function uploadProducerLogo(userId: string, uri: string, contentType: string) {
  if (!contentType.startsWith('image/')) throw new Error('Selecione uma imagem.');
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && 'size' in info && typeof info.size === 'number' && info.size > MAX_LOGO_BYTES) {
      throw new Error('Imagem muito grande (máx 5MB).');
    }
  } catch (caught) {
    if (caught instanceof Error && caught.message.includes('5MB')) throw caught;
  }
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  const path = `${userId}/${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}.${ext}`;
  const token = await getAccessToken();
  if (!token) throw new Error('Entre na conta para continuar.');
  const uploaded = await FileSystem.uploadAsync(`${SUPABASE_URL}/storage/v1/object/producer-logos/${path}`, uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType || 'image/jpeg',
      'x-upsert': 'false',
    },
  });
  if (uploaded.status < 200 || uploaded.status >= 300) {
    throw new Error('Falha ao enviar a foto.');
  }
  return `${SUPABASE_URL}/storage/v1/object/public/producer-logos/${path}`;
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

export function formatCep(value: string) {
  return digits(value, 8).replace(/(\d{5})(\d)/, '$1-$2');
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
