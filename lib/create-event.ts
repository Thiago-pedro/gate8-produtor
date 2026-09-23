import { getAccessToken, getAuthUser } from '@/lib/auth';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/config';
import { callServerFn } from '@/lib/server-fn';

const FN_GEOCODE = '7fb9a2c7e0a24d1b39ca13457d14bb01e800984c02d343d0954ee49b3e601d05';
const FN_COUPON = 'be4564ae045ec90f9b711b7b4ccb6325fd8af26222b33c77dcc2936b23399eed';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type EventCouponDraft = {
  active: boolean;
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: string;
};

export const EMPTY_COUPON: EventCouponDraft = {
  active: false,
  code: '',
  discountType: 'percent',
  discountValue: '',
};

type Row = Record<string, unknown>;

function text(value: unknown) {
  return value == null ? '' : String(value);
}

function asObject(value: unknown): Row | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Row;
  return null;
}

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function authHeaders() {
  const token = await getAccessToken();
  if (!token) throw new Error('Entre na conta de produtor para continuar.');
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
  };
}

export function maskCep(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function composeLocation(input: {
  venueName: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
}) {
  const streetLine = [input.street.trim(), input.number.trim()].filter(Boolean).join(', ');
  const cityLine = [input.city.trim(), input.state.trim()].filter(Boolean).join('/');
  const cep = input.cep.trim() ? `CEP ${input.cep.trim()}` : '';
  return [
    input.venueName.trim(),
    [streetLine, input.complement.trim()].filter(Boolean).join(' - '),
    input.neighborhood.trim(),
    cityLine,
    cep,
  ]
    .filter(Boolean)
    .join(' — ');
}

export function validateCoupon(coupon: EventCouponDraft) {
  if (!coupon.active) return null;
  if (coupon.code.trim().length < 3) return 'Informe um código de cupom com pelo menos 3 caracteres.';
  const value = Number(String(coupon.discountValue).replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return 'Informe o desconto do cupom.';
  if (coupon.discountType === 'percent' && value > 100) return 'O desconto em porcentagem não pode passar de 100%.';
  return null;
}

export async function lookupCep(cep: string) {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  const body = (await response.json()) as Row;
  if (body.erro) throw new Error('CEP não encontrado');
  return {
    street: text(body.logradouro),
    neighborhood: text(body.bairro),
    city: text(body.localidade),
    state: text(body.uf),
  };
}

export async function geocodeAddress(address: string) {
  const raw = asObject(await callServerFn<unknown>(FN_GEOCODE, { address }));
  const nested = asObject(raw?.data) ?? raw;
  if (!nested) return { latitude: null as number | null, longitude: null as number | null };
  const latitude = nested.latitude ?? nested.lat;
  const longitude = nested.longitude ?? nested.lng ?? nested.lon;
  return {
    latitude: latitude == null || latitude === '' ? null : num(latitude),
    longitude: longitude == null || longitude === '' ? null : num(longitude),
  };
}

function extFromType(contentType: string, fallback: string) {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  return fallback;
}

export async function uploadEventImage(uri: string, contentType: string, folder?: 'maps') {
  if (!contentType.startsWith('image/')) throw new Error('O arquivo precisa ser uma imagem.');
  const user = await getAuthUser();
  if (!user?.id) throw new Error('Sessão expirada. Entre novamente.');
  const headers = await authHeaders();
  const file = await fetch(uri);
  const blob = await file.blob();
  if (blob.size > MAX_IMAGE_BYTES) throw new Error('Imagem muito grande. Máx 5MB.');
  const ext = extFromType(contentType, folder === 'maps' ? 'png' : 'jpg');
  const path = folder === 'maps' ? `${user.id}/maps/${crypto.randomUUID()}.${ext}` : `${user.id}/${crypto.randomUUID()}.${ext}`;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/event-banners/${path}`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': contentType || blob.type || 'image/jpeg',
      'x-upsert': 'false',
    },
    body: blob,
  });
  const raw = await response.text();
  if (!response.ok) {
    let message = 'Falha ao enviar a imagem.';
    try {
      const parsed = JSON.parse(raw) as { message?: string; error?: string };
      message = parsed.message || parsed.error || message;
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/event-banners/${path}`;
}

export async function createProducerEvent(input: {
  name: string;
  description: string;
  eventDate: Date;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  capacity: number | null;
  bannerUrl: string | null;
  mapUrl: string | null;
  status: 'draft' | 'published';
  hasTables: boolean;
  isHidden: boolean;
}) {
  const user = await getAuthUser();
  if (!user?.id) throw new Error('Sessão expirada. Entre novamente.');
  const headers = await authHeaders();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
    method: 'POST',
    headers: {
      ...headers,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      name: input.name.trim(),
      description: input.description.trim() || null,
      event_date: input.eventDate.toISOString(),
      location: input.location,
      latitude: input.latitude,
      longitude: input.longitude,
      capacity: input.capacity,
      banner_url: input.bannerUrl,
      map_url: input.mapUrl,
      status: input.status,
      has_tables: input.hasTables,
      is_hidden: input.isHidden,
      created_by: user.id,
    }),
  });
  const raw = await response.text();
  let parsed: unknown = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      parsed = null;
    }
  }
  if (!response.ok) {
    const message =
      asObject(parsed)?.message || asObject(parsed)?.hint || asObject(parsed)?.details;
    throw new Error(text(message) || 'Não foi possível criar o evento.');
  }
  const row = asRows(parsed)[0] ?? asObject(parsed);
  const id = text(row?.id);
  if (!id) throw new Error('Não foi possível criar o evento.');
  return id;
}

export async function saveEventCoupon(eventId: string, coupon: EventCouponDraft) {
  if (!coupon.active) return;
  await callServerFn(FN_COUPON, {
    event_id: eventId,
    code: coupon.code.trim(),
    discount_type: coupon.discountType,
    discount_value: Number(String(coupon.discountValue).replace(',', '.')),
    active: true,
  });
}
