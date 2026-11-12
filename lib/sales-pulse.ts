/** Visão geral do evento — mesmas regras do site (America/Sao_Paulo). Sem I/O. */

export type SalesDayPoint = {
  key: string;
  label: string;
  count: number;
};

export type SalesPulse = {
  soldPaid: number;
  courtesy: number;
  soldToday: number;
  soldLast7: number;
  validated: number;
  daily: SalesDayPoint[];
};

export type SalesTicketRow = {
  id?: unknown;
  status?: unknown;
  payment_method?: unknown;
  created_at?: unknown;
};

const MONTHS_PT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const;

export function brazilDayKey(value: Date | string = new Date()) {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Rótulo do gráfico no site: "12 nov". */
export function brazilDayLabel(dayKey: string) {
  const [year, month, day] = dayKey.split('-').map(Number);
  if (!year || !month || !day) return dayKey;
  return `${day} ${MONTHS_PT[month - 1] ?? ''}`;
}

/** Últimos `n` dias (hoje incluso), do mais antigo ao mais recente, em BRT. */
export function lastNDayKeys(n: number, now = new Date()) {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    keys.push(brazilDayKey(new Date(now.getTime() - i * 24 * 60 * 60 * 1000)));
  }
  return keys;
}

function isCancelled(status: unknown) {
  return String(status ?? '')
    .trim()
    .toLowerCase() === 'cancelled';
}

function isPaid(paymentMethod: unknown) {
  return paymentMethod != null && String(paymentMethod).trim() !== '';
}

/**
 * Ativos = status !== cancelled.
 * Vendidos = ativos com payment_method.
 * Cortesias = ativos sem payment_method.
 * Validados = status === used (igual ao site).
 * Dias = America/Sao_Paulo.
 */
export function buildSalesPulse(tickets: SalesTicketRow[], now = new Date()): SalesPulse {
  const keys = lastNDayKeys(7, now);
  const today = keys[keys.length - 1] ?? brazilDayKey(now);
  const counts = new Map(keys.map((key) => [key, 0]));

  let soldPaid = 0;
  let courtesy = 0;
  let validated = 0;

  for (const ticket of tickets) {
    const status = String(ticket.status ?? '')
      .trim()
      .toLowerCase();
    if (isCancelled(status)) continue;

    if (status === 'used') validated += 1;

    if (isPaid(ticket.payment_method)) {
      soldPaid += 1;
      const created = ticket.created_at == null ? '' : String(ticket.created_at);
      if (!created) continue;
      const key = brazilDayKey(created);
      if (!counts.has(key)) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    } else {
      courtesy += 1;
    }
  }

  const daily = keys.map((key) => ({
    key,
    label: brazilDayLabel(key),
    count: counts.get(key) ?? 0,
  }));

  return {
    soldPaid,
    courtesy,
    soldToday: counts.get(today) ?? 0,
    soldLast7: daily.reduce((sum, point) => sum + point.count, 0),
    validated,
    daily,
  };
}
