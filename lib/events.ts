import { getAccessToken } from '@/lib/auth';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/config';

export type ProducerEvent = {
  id: string;
  name: string;
  slug: string;
  event_date: string | null;
  status: string | null;
  banner_url: string | null;
};

export async function fetchProducerEvents(): Promise<ProducerEvent[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Entre na conta de produtor para continuar.');

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/events?select=id,name,slug,event_date,status,banner_url&order=event_date.desc`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    }
  );

  const body = (await response.json().catch(() => null)) as ProducerEvent[] | { message?: string } | null;
  if (!response.ok) {
    const message = body && !Array.isArray(body) ? body.message : null;
    throw new Error(message || 'Não foi possível carregar os eventos.');
  }

  return Array.isArray(body) ? body : [];
}
