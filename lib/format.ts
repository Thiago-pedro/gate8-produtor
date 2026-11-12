export {
  eventEffectiveEnd,
  formatEventEndShort,
  formatEventPeriod,
  formatEventPeriodParts,
  validateEventPeriod,
} from '@/lib/event-period';

const BRT = 'America/Sao_Paulo';

export function formatEventDate(value: string | null) {
  if (!value) return 'Data a definir';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data a definir';
  return date.toLocaleDateString('pt-BR', {
    timeZone: BRT,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatEventDateTime(value: string | null) {
  if (!value) return 'Data a definir';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data a definir';
  const day = date.toLocaleDateString('pt-BR', {
    timeZone: BRT,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const time = date.toLocaleTimeString('pt-BR', {
    timeZone: BRT,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${day} · ${time}`;
}

function capitalizePt(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Ex.: "12 de Dezembro de 2026" */
export function formatEventDateLong(value: string | null) {
  if (!value) return 'Data a definir';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data a definir';
  const raw = date.toLocaleDateString('pt-BR', {
    timeZone: BRT,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return raw.replace(/(\d+\s+de\s+)([a-zà-ú])/i, (_, prefix: string, letter: string) => {
    return `${prefix}${letter.toUpperCase()}`;
  });
}

/** Ex.: "22h" ou "22h30" */
export function formatEventHour(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRT,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  const h = String(Number(hour));
  if (minute === '00') return `${h}h`;
  return `${h}h${minute}`;
}

/** Ex.: "Sábado • 22h" */
export function formatEventWeekdayTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const weekday = capitalizePt(
    date.toLocaleDateString('pt-BR', {
      timeZone: BRT,
      weekday: 'long',
    })
  );
  const hour = formatEventHour(value);
  return hour ? `${weekday} • ${hour}` : weekday;
}

/** Local composto (`Local — rua — bairro — cidade/UF`) → título + endereço. */
export function splitEventLocation(location: string | null | undefined) {
  const raw = (location ?? '').trim();
  if (!raw) return { title: null as string | null, detail: null as string | null };
  const parts = raw
    .split(/\s*[—–]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return { title: raw, detail: null as string | null };
  return {
    title: parts[0] ?? raw,
    detail: parts.slice(1).join(' – '),
  };
}

export function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function formatDateTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatCheckinAt(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const formatted = date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return formatted.replace(',', '');
}
