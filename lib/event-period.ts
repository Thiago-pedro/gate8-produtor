const BRT = 'America/Sao_Paulo';
const EVENT_SOON = 'Data e hora em breve';

type BrazilParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
};

function brazilParts(date: Date): BrazilParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRT,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

function periodDate(parts: BrazilParts) {
  return `${parts.day}/${parts.month}/${parts.year}`;
}

function periodDateShort(parts: BrazilParts) {
  return `${parts.day}/${parts.month}`;
}

function periodTime(parts: BrazilParts) {
  return `${parts.hour}h${parts.minute}`;
}

function sameBrazilDay(left: BrazilParts, right: BrazilParts) {
  return left.year === right.year && left.month === right.month && left.day === right.day;
}

/** Fim real do evento: término se existir, senão o início. */
export function eventEffectiveEnd(
  start: string | null | undefined,
  end?: string | null | undefined
) {
  if (end) {
    const date = new Date(end);
    if (!Number.isNaN(date.getTime())) return end;
  }
  if (start) {
    const date = new Date(start);
    if (!Number.isNaN(date.getTime())) return start;
  }
  return null;
}

/**
 * Linhas do card de data:
 * - só início → `{ line1, mid: null, line2: null }`
 * - com término → início / "até" / término (sem "até" no texto do fim)
 */
export function formatEventPeriodParts(
  start: string | null | undefined,
  end?: string | null | undefined
): { line1: string; mid: string | null; line2: string | null } {
  if (!start) return { line1: EVENT_SOON, mid: null, line2: null };
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return { line1: EVENT_SOON, mid: null, line2: null };
  const startParts = brazilParts(startDate);
  const line1 = `${periodDate(startParts)} às ${periodTime(startParts)}`;
  if (!end) return { line1, mid: null, line2: null };
  const endDate = new Date(end);
  if (Number.isNaN(endDate.getTime())) return { line1, mid: null, line2: null };
  const endParts = brazilParts(endDate);
  const line2 = sameBrazilDay(startParts, endParts)
    ? periodTime(endParts)
    : `${periodDate(endParts)} às ${periodTime(endParts)}`;
  return { line1, mid: 'até', line2 };
}

/**
 * Período do evento (igual ao site):
 * - sem término → `14/11/2026 às 18h00`
 * - mesmo dia → `14/11/2026 às 18h00 até 22h30`
 * - outro dia → `14/11/2026 às 22h00 até 15/11/2026 às 06h00`
 */
export function formatEventPeriod(
  start: string | null | undefined,
  end?: string | null | undefined
) {
  const parts = formatEventPeriodParts(start, end);
  if (!parts.line2 || !parts.mid) return parts.line1;
  return `${parts.line1} ${parts.mid} ${parts.line2}`;
}

/** Card apertado: `até 15/11 às 06h00`. Sem término → string vazia. */
export function formatEventEndShort(
  start: string | null | undefined,
  end?: string | null | undefined
) {
  if (!end) return '';
  const endDate = new Date(end);
  if (Number.isNaN(endDate.getTime())) return '';
  const endParts = brazilParts(endDate);
  return `até ${periodDateShort(endParts)} às ${periodTime(endParts)}`;
}

/** Valida início/término no criar/editar. Retorna mensagem em PT ou null. */
export function validateEventPeriod(start: Date | null, end: Date | null) {
  if (end && !start) return 'Informe a data e hora de início antes do término.';
  if (start && Number.isNaN(start.getTime())) return 'Data e hora inválidas.';
  if (end && Number.isNaN(end.getTime())) return 'Data e hora inválidas.';
  if (start && end && !(end.getTime() > start.getTime())) {
    return 'O término precisa ser depois do início.';
  }
  return null;
}
