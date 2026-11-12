/** Cálculos puros do Financeiro — espelham o site (qr7-platform). Sem I/O. */

type Row = Record<string, unknown>;

export type FinancePackageStats = {
  packagesSold: number;
  packageTickets: number;
  extraTickets: number;
  courtesyTickets: number;
  total: number;
  clients: number;
};

export type FinanceBatchSale = {
  id: string;
  name: string;
  sold: number;
};

export type FinanceSaleRow = {
  isCourtesy?: boolean;
  isCancelled?: boolean;
  isPos?: boolean;
  method?: string | null;
  boletoIssuedCount?: number;
  boletoPaidCount?: number;
};

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function text(value: unknown) {
  return value == null ? '' : String(value);
}

function money(value: number) {
  return Number(value.toFixed(2));
}

function nested(row: Row, key: string): Row | null {
  const value = row[key];
  if (Array.isArray(value) && value[0] && typeof value[0] === 'object') {
    return value[0] as Row;
  }
  if (value && typeof value === 'object') return value as Row;
  return null;
}

function isCancelledStatus(value: unknown) {
  const status = text(value).trim().toLowerCase();
  return [
    'cancelled',
    'canceled',
    'refunded',
    'refund',
    'void',
    'reversed',
    'estornado',
    'chargedback',
  ].includes(status);
}

/**
 * Contagens de pacote/extra/cortesia — `countParameterReportTickets` no site.
 * Clientes = `purchase.user_id` distintos (EventFinanceDialog).
 */
export function computePackageStats(
  tickets: Row[],
  batches: Row[],
  batchIdFilter = ''
): FinancePackageStats {
  const byBatch = new Map<string, { all: number; stored: number }>();
  const clients = new Set<string>();
  for (const ticket of tickets) {
    if (isCancelledStatus(ticket.status)) continue;
    const batchId = text(ticket.batch_id);
    if (batchIdFilter && batchId !== batchIdFilter) continue;
    const bucket = byBatch.get(batchId) ?? { all: 0, stored: 0 };
    bucket.all += 1;
    if (!ticket.payment_method) bucket.stored += 1;
    byBatch.set(batchId, bucket);
    const purchase = nested(ticket, 'purchase') ?? nested(ticket, 'purchase_orders');
    const userId = text(purchase?.user_id);
    if (userId) clients.add(userId);
  }

  const out: FinancePackageStats = {
    packagesSold: 0,
    packageTickets: 0,
    extraTickets: 0,
    courtesyTickets: 0,
    total: 0,
    clients: clients.size,
  };

  for (const [batchId, counts] of byBatch) {
    const batch = batches.find((row) => text(row.id) === batchId);
    const perPurchase = Math.max(1, num(batch?.tickets_per_purchase) || 1);
    const complimentary = Math.max(0, num(batch?.complimentary_per_purchase));
    const isPackage = complimentary > 0 && perPurchase > complimentary;
    const courtesy = isPackage
      ? Math.min(counts.all, Math.ceil(counts.all / perPurchase) * complimentary)
      : counts.stored;
    out.courtesyTickets += courtesy;
    out.total += counts.all;
    if (isPackage) {
      out.packageTickets += counts.all;
      out.packagesSold += Math.ceil(counts.all / perPurchase);
    } else {
      out.extraTickets += counts.all;
    }
  }
  return out;
}

/**
 * Cards por lote no Financeiro do site: um card por `ticket_batches` (sort_order),
 * valor = ingressos não cancelados com `payment_method` preenchido (nulo = cortesia).
 */
export function computeBatchSoldCards(tickets: Row[], batches: Row[]): FinanceBatchSale[] {
  const sold = new Map<string, number>();
  for (const ticket of tickets) {
    if (isCancelledStatus(ticket.status)) continue;
    if (ticket.payment_method == null || ticket.payment_method === '') continue;
    const batchId = text(ticket.batch_id);
    if (!batchId) continue;
    sold.set(batchId, (sold.get(batchId) ?? 0) + 1);
  }

  const ordered = [...batches].sort((a, b) => {
    const byOrder = num(a.sort_order) - num(b.sort_order);
    if (byOrder !== 0) return byOrder;
    return text(a.id).localeCompare(text(b.id));
  });

  return ordered.map((batch) => {
    const id = text(batch.id);
    return {
      id,
      name: text(batch.name).trim() || 'Lote',
      sold: sold.get(id) ?? 0,
    };
  });
}

/** Uma linha = uma venda; boleto só conta com todas as parcelas pagas. */
export function buildFinanceSalesCount(rows: FinanceSaleRow[]): number {
  return rows.reduce((count, row) => {
    if (row.isCourtesy || row.isCancelled) return count;
    if (row.method === 'boleto') {
      const issued = row.boletoIssuedCount ?? 0;
      const paid = row.boletoPaidCount ?? 0;
      return issued > 0 && paid >= issued ? count + 1 : count;
    }
    return row.isPos || row.method === 'pix' || row.method === 'credit_card' ? count + 1 : count;
  }, 0);
}

/** Líquido do evento − retiradas pagas − retiradas pendentes. */
export function availableLiquid(eventNet: number, withdrawnTotal: number) {
  const net = Number.isFinite(eventNet) ? eventNet : 0;
  const withdrawn = Number.isFinite(withdrawnTotal) ? withdrawnTotal : 0;
  return Math.max(0, money(net - money(withdrawn)));
}

export function bankNetOnSite(siteNet: number, boletoNet: number, withdrawnTotal: number, posNet = 0) {
  return availableLiquid(siteNet + boletoNet + posNet, withdrawnTotal);
}
