import { callServerFn } from '@/lib/server-fn';

const FN_TERMS = '17a20a57b6f757f42871f2f99d70070b0539689df7c79e0dac9d10c4da66cb24';

type Row = Record<string, unknown>;

export type ProducerTerms = {
  pixPercent: number;
  creditPercent: number;
  sameRate: boolean;
};

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function displayRate(value: number) {
  return value === 12 ? 7.99 : value;
}

export async function fetchProducerTerms(eventId?: string): Promise<ProducerTerms> {
  const raw = await callServerFn<Row>(FN_TERMS, eventId ? { eventId } : {}, { method: 'GET', auth: false });
  const pixPercent = displayRate(num(raw.pixPercent ?? raw.pix_percent));
  const creditPercent = displayRate(num(raw.creditPercent ?? raw.credit_percent));
  return {
    pixPercent,
    creditPercent,
    sameRate: pixPercent === creditPercent,
  };
}

export function formatPercent(value: number) {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}%`;
}

export function feeOnHundred(percent: number) {
  return 100 * (percent / 100);
}
