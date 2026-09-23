import { getAccessToken } from '@/lib/auth';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/config';
import { callServerFn } from '@/lib/server-fn';

const FN_FEES = '915adb06b5a9905d31d0ef78f112185f447176a61bd89297229912ee0bb03e08';
const FN_COUPONS = 'd4a64bc7e81e84235d128c0567f46ada25f0e084a6536efd324ca09920c1315f';
const FN_COUPONS_FALLBACK = '62d3f0a1966c1677137c3679d30aeae1587abdbcc4fbbfb0fff44b8750c9f21e';

const PIX_BANK = 1.09;
const CREDIT_BANK = 5.09;

type Row = Record<string, unknown>;
type FeeSplit = { bank?: number; gate8?: number };

type FinancePurchase = {
  key: string;
  purchaseCode: string | null;
  sampleCode: string;
  buyer: string;
  method: string | null;
  isCourtesy: boolean;
  isCancelled: boolean;
  isPos: boolean;
  ticketCount: number;
  financialGross: number;
  billableGross: number;
  serviceFee: number;
  bankFee: number;
  net: number;
  couponCode: string | null;
  couponDiscount: number;
  hasCoupon: boolean;
  createdAt: string | null;
  installments: number;
  snapshotBankPercent: number | null;
  paidTotal: number;
  paidKnown: boolean;
  cancelledCount: number;
  charged: number;
};

export type FinanceChannel = {
  count: number;
  gross: number;
  bank: number;
  gate8: number;
  net: number;
  pix: number;
  credit_card: number;
  debit: number;
  cash: number;
  pixCount: number;
  creditCount: number;
  debitCount: number;
  cashCount: number;
};

export type EventFinance = {
  producerMode: boolean;
  producerPercent: number;
  totals: {
    gross: number;
    serviceFee: number;
    bankFee: number;
    net: number;
    paid: number;
    courtesy: number;
    couponDiscount: number;
    couponCount: number;
    cancelledTickets: number;
    cancelledAmount: number;
  };
  site: FinanceChannel;
  pos: FinanceChannel;
};

type Group = {
  key: string;
  purchaseCode: string | null;
  buyer: string;
  method: string | null;
  isCourtesy: boolean;
  isCancelled: boolean;
  isPos: boolean;
  ticketCount: number;
  gross: number;
  billableGross: number;
  financialGross: number;
  createdAt: string | null;
  sampleCode: string;
  couponCode: string | null;
  couponDiscount: number;
  cancelledCount: number;
  paidTotal: number;
  paidKnown: boolean;
  seenPurchases: Set<string>;
  snapshotBankFee: number;
  snapshotGate8Fee: number;
  snapshotNet: number;
  snapshotKnown: boolean;
  installments: number;
  snapshotBankPercent: number | null;
};

async function headers() {
  const token = await getAccessToken();
  if (!token) throw new Error('Entre na conta de produtor para continuar.');
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function rest<T>(path: string): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: await headers(),
  });
  const raw = await response.text();
  const body = raw ? (JSON.parse(raw) as unknown) : null;
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && body !== null && 'message' in body
        ? String((body as { message?: string }).message)
        : null;
    throw new Error(message || 'Não foi possível carregar o financeiro.');
  }
  return body as T;
}

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

async function firstRest(paths: string[]): Promise<Row[]> {
  for (const path of paths) {
    try {
      return asRows(await rest(path));
    } catch {
      // tenta o próximo select se a coluna ou o embed não existir
    }
  }
  return [];
}

async function pagedRest(paths: string[]): Promise<Row[]> {
  for (const path of paths) {
    try {
      const rows: Row[] = [];
      let from = 0;
      for (;;) {
        const page = asRows(await rest(`${path}${path.includes('?') ? '&' : '?'}offset=${from}&limit=1000`));
        rows.push(...page);
        if (page.length < 1000) break;
        from += 1000;
      }
      return rows;
    } catch {
      // tenta o próximo select
    }
  }
  return [];
}

function nested(row: Row, key: string): Row | null {
  const value = row[key];
  if (Array.isArray(value) && value[0] && typeof value[0] === 'object') {
    return value[0] as Row;
  }
  if (value && typeof value === 'object') return value as Row;
  return null;
}

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

type CouponHit = { code: string | null; discount: number };

function couponFromUnknown(value: unknown): CouponHit | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Row;
  const code = text(row.code || row.coupon_code || row.couponCode) || null;
  const discount = num(
    row.discount ?? row.discount_amount ?? row.coupon_discount ?? row.couponDiscount ?? row.amount
  );
  if (!code && !(discount > 0)) return null;
  return { code, discount };
}

function mergeCoupon(into: Record<string, CouponHit>, key: string | null, hit: CouponHit | null) {
  if (!key || !hit) return;
  const current = into[key];
  if (!current) {
    into[key] = { code: hit.code, discount: hit.discount };
    return;
  }
  if (!current.code && hit.code) current.code = hit.code;
  if (!(current.discount > 0) && hit.discount > 0) current.discount = hit.discount;
}

function normalizeCoupons(raw: unknown): { byPurchaseId: Record<string, CouponHit>; byOrderId: Record<string, CouponHit> } {
  const byPurchaseId: Record<string, CouponHit> = {};
  const byOrderId: Record<string, CouponHit> = {};
  if (!raw) return { byPurchaseId, byOrderId };
  const root = typeof raw === 'object' ? (raw as Row) : {};
  const nested = root.data && typeof root.data === 'object' ? (root.data as Row) : root;

  const asMap = (value: unknown) =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

  const purchaseMap = asMap(nested.byPurchaseId ?? nested.by_purchase_id);
  if (purchaseMap) {
    for (const [key, value] of Object.entries(purchaseMap)) {
      mergeCoupon(byPurchaseId, key, couponFromUnknown(value));
    }
  }
  const orderMap = asMap(nested.byOrderId ?? nested.by_order_id);
  if (orderMap) {
    for (const [key, value] of Object.entries(orderMap)) {
      mergeCoupon(byOrderId, key, couponFromUnknown(value));
    }
  }

  const rows = Array.isArray(nested)
    ? nested
    : Array.isArray(nested.coupons)
      ? nested.coupons
      : Array.isArray(nested.items)
        ? nested.items
        : [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Row;
    const hit = couponFromUnknown(item);
    mergeCoupon(byPurchaseId, text(item.purchase_id || item.purchaseId) || null, hit);
    mergeCoupon(byOrderId, text(item.pagarme_order_id || item.order_id) || null, hit);
  }

  return { byPurchaseId, byOrderId };
}

function couponFromPurchase(purchase: Row | null): CouponHit | null {
  if (!purchase) return null;
  const snapshot =
    purchase.fee_snapshot && typeof purchase.fee_snapshot === 'object' ? (purchase.fee_snapshot as Row) : null;
  const code =
    text(
      purchase.coupon_code ||
        purchase.couponCode ||
        snapshot?.coupon_code ||
        snapshot?.couponCode
    ) || null;
  const discount = num(
    purchase.discount_amount ??
      purchase.coupon_discount ??
      purchase.couponDiscount ??
      snapshot?.coupon_discount ??
      snapshot?.discount_amount ??
      snapshot?.couponDiscount
  );
  if (!code && !(discount > 0)) return null;
  return { code, discount };
}

function emptyChannel(): FinanceChannel {
  return {
    count: 0,
    gross: 0,
    bank: 0,
    gate8: 0,
    net: 0,
    pix: 0,
    credit_card: 0,
    debit: 0,
    cash: 0,
    pixCount: 0,
    creditCount: 0,
    debitCount: 0,
    cashCount: 0,
  };
}

async function fetchTickets(eventId: string) {
  const id = encodeURIComponent(eventId);
  const purchaseSelects = [
    'code,pagarme_order_id,user_id,created_at,total_amount,fee_snapshot,coupon_code,discount_amount,coupon_discount,status',
    'code,pagarme_order_id,user_id,created_at,total_amount,fee_snapshot,coupon_code,discount_amount',
    'code,pagarme_order_id,user_id,created_at,total_amount,fee_snapshot',
    'code,pagarme_order_id,created_at,total_amount,fee_snapshot',
    'code,total_amount,fee_snapshot',
    'code,total_amount',
  ];
  const ticketSelects = purchaseSelects.flatMap((purchase) => [
    `id,code,holder_name,status,payment_method,created_at,created_by,batch_id,table_id,seat_total,purchase_id,batch:ticket_batches(name,price),purchase:purchase_orders(${purchase})`,
    `id,code,holder_name,status,payment_method,created_at,created_by,batch_id,table_id,seat_total,purchase_id,ticket_batches(name,price),purchase_orders(${purchase})`,
  ]);
  ticketSelects.push(
    'id,code,holder_name,status,payment_method,created_at,created_by,batch_id,table_id,seat_total,purchase_id'
  );

  return pagedRest(
    ticketSelects.map(
      (select) =>
        `tickets?select=${select}&event_id=eq.${id}&order=created_at.desc`
    )
  );
}

async function fetchTables(eventId: string) {
  const id = encodeURIComponent(eventId);
  return firstRest([
    `event_tables?select=id,price,seats,custom_label,table_number&event_id=eq.${id}`,
    `event_tables?select=id,price,seats&event_id=eq.${id}`,
  ]);
}

async function fetchPosIds(eventId: string) {
  const id = encodeURIComponent(eventId);
  const rows = await firstRest([
    `pos_sale_items?select=ticket_id,total,ticket:tickets!inner(event_id,purchase_id)&ticket.event_id=eq.${id}&ticket_id=not.is.null`,
    `pos_sale_items?select=ticket_id,ticket:tickets!inner(event_id,purchase_id)&tickets.event_id=eq.${id}`,
  ]);
  const ticketIds = new Set<string>();
  const purchaseIds = new Set<string>();
  for (const row of rows) {
    const ticketId = text(row.ticket_id);
    if (ticketId) ticketIds.add(ticketId);
    const ticket = nested(row, 'ticket') ?? nested(row, 'tickets');
    const purchaseId = text(ticket?.purchase_id ?? row.purchase_id);
    if (purchaseId) purchaseIds.add(purchaseId);
  }
  return { ticketIds, purchaseIds };
}

async function fetchFees(eventId: string) {
  try {
    return await callServerFn<{
      percent?: number;
      producerPercent?: number;
      siteFeesDetailed?: { pix?: FeeSplit; credit?: FeeSplit };
      posFees?: { credit?: number; debit?: number; pix?: number };
      posFeesDetailed?: {
        brands?: Record<string, { credit?: FeeSplit; debit?: FeeSplit }>;
        pix?: FeeSplit;
        cash?: FeeSplit;
      };
    }>(FN_FEES, { eventId }, { method: 'GET', auth: false });
  } catch {
    return null;
  }
}

async function fetchCoupons(eventId: string) {
  for (const id of [FN_COUPONS, FN_COUPONS_FALLBACK]) {
    for (const payload of [{ event_id: eventId }, { eventId }]) {
      try {
        const data = await callServerFn<unknown>(id, payload);
        const normalized = normalizeCoupons(data);
        if (Object.keys(normalized.byPurchaseId).length > 0 || Object.keys(normalized.byOrderId).length > 0) {
          return normalized;
        }
      } catch {
        // tenta o próximo payload / endpoint
      }
    }
  }

  const encoded = encodeURIComponent(eventId);
  const rows = await firstRest([
    `coupon_redemptions?select=purchase_id,pagarme_order_id,code,discount,discount_amount,coupon_code&event_id=eq.${encoded}`,
    `coupon_usages?select=purchase_id,pagarme_order_id,code,discount,discount_amount,coupon_code&event_id=eq.${encoded}`,
    `purchase_coupons?select=purchase_id,pagarme_order_id,code,discount,discount_amount,coupon_code&event_id=eq.${encoded}`,
    `applied_coupons?select=purchase_id,pagarme_order_id,code,discount,discount_amount,coupon_code&event_id=eq.${encoded}`,
    `event_coupon_uses?select=purchase_id,pagarme_order_id,code,discount,discount_amount,coupon_code&event_id=eq.${encoded}`,
  ]);
  return normalizeCoupons(rows);
}

function chargedAmount(group: Group) {
  if (group.paidKnown && group.paidTotal > 0) return group.paidTotal;
  const snapshotCharge = group.snapshotNet + group.snapshotBankFee + group.snapshotGate8Fee;
  if (snapshotCharge > 0) return snapshotCharge;
  return group.gross;
}

function ticketPrice(ticket: Row, tables: Map<string, Row>) {
  const batch = nested(ticket, 'batch') ?? nested(ticket, 'ticket_batches');
  if (ticket.batch_id && batch) return num(batch.price);
  const tableId = text(ticket.table_id);
  if (tableId) {
    const table = tables.get(tableId);
    if (table) {
      const seats = num(ticket.seat_total) || num(table.seats) || 1;
      return num(table.price) / seats;
    }
  }
  return 0;
}

function groupKey(ticket: Row, purchase: Row | null) {
  const orderId = text(purchase?.pagarme_order_id);
  if (orderId) return `pg:${orderId}`;
  const userId = text(purchase?.user_id);
  const createdAt = text(purchase?.created_at);
  const method = text(ticket.payment_method);
  if (userId && createdAt && method) {
    const minute = Math.floor(new Date(createdAt).getTime() / 60000);
    return `usr:${userId}:${method}:${minute}`;
  }
  return text(ticket.purchase_id) || `solo-${text(ticket.id)}`;
}

export async function fetchEventFinance(eventId: string): Promise<EventFinance> {
  const [tickets, tableRows, pos, fees, coupons] = await Promise.all([
    fetchTickets(eventId),
    fetchTables(eventId),
    fetchPosIds(eventId),
    fetchFees(eventId),
    fetchCoupons(eventId),
  ]);

  const tables = new Map(tableRows.map((row) => [text(row.id), row]));
  const detailed = fees?.siteFeesDetailed;
  const pixGate8 = num(detailed?.pix?.gate8);
  const creditGate8 = num(detailed?.credit?.gate8);
  const pixBank = num(detailed?.pix?.bank) || PIX_BANK;
  const creditBank = num(detailed?.credit?.bank) || CREDIT_BANK;
  const producerPercent = num(fees?.producerPercent);
  const producerMode = producerPercent > 0;
  const posFees = {
    credit: num(fees?.posFees?.credit),
    debit: num(fees?.posFees?.debit),
    pix: num(fees?.posFees?.pix),
  };

  const groups = new Map<string, Group>();

  for (const ticket of tickets) {
    const purchase = nested(ticket, 'purchase') ?? nested(ticket, 'purchase_orders');
    const courtesy = !ticket.payment_method;
    const purchaseId = text(ticket.purchase_id) || null;
    const isPos =
      !courtesy &&
      (pos.ticketIds.has(text(ticket.id)) || (!!purchaseId && pos.purchaseIds.has(purchaseId)));
    if (!courtesy && !isPos && !purchaseId) continue;

    const unit = ticketPrice(ticket, tables);
    const cancelled = isCancelledStatus(ticket.status) || isCancelledStatus(purchase?.status);
    const billable = courtesy || cancelled ? 0 : unit;
    const buyer = text(ticket.holder_name) || '—';
    const coupon =
      (purchaseId ? coupons.byPurchaseId?.[purchaseId] : undefined) ??
      (purchase?.pagarme_order_id
        ? coupons.byOrderId?.[text(purchase.pagarme_order_id)]
        : undefined) ??
      couponFromPurchase(purchase);
    const key = groupKey(ticket, purchase);
    const paidTotal = purchase?.total_amount != null ? num(purchase.total_amount) : null;
    const snapshot = purchase?.fee_snapshot && typeof purchase.fee_snapshot === 'object'
      ? (purchase.fee_snapshot as Row)
      : null;
    const current = groups.get(key);

    if (current) {
      if (!current.couponCode && coupon?.code) current.couponCode = coupon.code;
      if (!(current.couponDiscount > 0) && coupon && coupon.discount > 0) {
        current.couponDiscount = num(coupon.discount);
      }
      current.ticketCount += 1;
      current.cancelledCount += cancelled ? 1 : 0;
      current.gross += unit;
      current.billableGross += billable;
      current.isCancelled = current.cancelledCount === current.ticketCount;
      if (purchaseId && paidTotal != null && Number.isFinite(paidTotal) && !current.seenPurchases.has(purchaseId)) {
        current.seenPurchases.add(purchaseId);
        current.paidTotal += paidTotal;
        current.paidKnown = true;
        if (snapshot) {
          current.snapshotBankFee += num(snapshot.bank_amount);
          current.snapshotGate8Fee += num(snapshot.gate8_amount);
          current.snapshotNet += num(snapshot.net_amount);
          current.snapshotKnown = true;
        }
      }
    } else {
      const seen = new Set<string>();
      if (purchaseId && paidTotal != null) seen.add(purchaseId);
      groups.set(key, {
        key,
        purchaseCode: purchase?.code ? text(purchase.code) : null,
        buyer,
        method: ticket.payment_method ? text(ticket.payment_method) : null,
        isCourtesy: courtesy,
        isCancelled: cancelled,
        isPos,
        ticketCount: 1,
        cancelledCount: cancelled ? 1 : 0,
        gross: unit,
        billableGross: billable,
        financialGross: billable,
        createdAt: ticket.created_at ? text(ticket.created_at) : null,
        sampleCode: text(ticket.code),
        couponCode: coupon?.code ?? null,
        couponDiscount: num(coupon?.discount),
        paidTotal: paidTotal != null && Number.isFinite(paidTotal) ? paidTotal : 0,
        paidKnown: paidTotal != null && Number.isFinite(paidTotal),
        seenPurchases: seen,
        snapshotBankFee: snapshot ? num(snapshot.bank_amount) : 0,
        snapshotGate8Fee: snapshot ? num(snapshot.gate8_amount) : 0,
        snapshotNet: snapshot ? num(snapshot.net_amount) : 0,
        snapshotKnown: Boolean(snapshot),
        installments: snapshot ? Math.max(1, num(snapshot.installments) || 1) : 1,
        snapshotBankPercent: snapshot?.bank_percent != null ? num(snapshot.bank_percent) : null,
      });
    }
  }

  const purchases = Array.from(groups.values()).map((group) => {
    if (
      !(group.couponDiscount > 0) &&
      !group.isCancelled &&
      !group.isCourtesy &&
      !group.isPos &&
      !producerMode &&
      group.snapshotKnown
    ) {
      const inferred = money(group.gross - group.snapshotNet);
      if (inferred >= 0.01) group.couponDiscount = inferred;
    }
    group.billableGross = Math.max(0, group.billableGross - group.couponDiscount);
    group.financialGross = group.billableGross;
    let serviceFee = 0;
    let bankFee = 0;
    if (!group.isCourtesy && !group.isCancelled) {
      if (group.isPos) {
        if (group.method === 'pix') bankFee = group.billableGross * (posFees.pix / 100);
        else if (group.method === 'credit_card') bankFee = group.billableGross * (posFees.credit / 100);
        else if (group.method === 'debit') bankFee = group.billableGross * (posFees.debit / 100);
      } else if (group.snapshotKnown) {
        if (group.paidKnown) group.financialGross = group.paidTotal;
        bankFee = group.snapshotBankFee;
        serviceFee = group.snapshotGate8Fee;
      } else if (producerMode) {
        serviceFee = group.billableGross * (producerPercent / 100);
      } else {
        const extra = group.paidKnown
          ? Math.max(0, money(group.paidTotal - group.billableGross))
          : null;
        if (group.paidKnown) group.financialGross = group.paidTotal;
        if (group.method === 'pix') {
          const bank = group.gross * (pixBank / 100);
          bankFee = extra != null ? bank : group.billableGross * (pixBank / 100);
          serviceFee = extra != null ? Math.max(0, extra - bank) : group.billableGross * (pixGate8 / 100);
        } else if (group.method === 'credit_card') {
          const bank = group.gross * (creditBank / 100);
          bankFee = extra != null ? bank : group.billableGross * (creditBank / 100);
          serviceFee = extra != null ? Math.max(0, extra - bank) : group.billableGross * (creditGate8 / 100);
        }
      }
    }
    const net = group.snapshotKnown
      ? group.snapshotNet
      : group.financialGross - serviceFee - bankFee;
    const hasCoupon = Boolean(group.couponCode) || group.couponDiscount > 0;
    return {
      key: group.key,
      purchaseCode: group.purchaseCode,
      sampleCode: group.sampleCode,
      buyer: group.buyer,
      method: group.method,
      isCourtesy: group.isCourtesy,
      isCancelled: group.isCancelled,
      isPos: group.isPos,
      ticketCount: group.ticketCount,
      financialGross: group.financialGross,
      billableGross: group.billableGross,
      serviceFee,
      bankFee,
      net,
      couponCode: group.couponCode,
      couponDiscount: group.couponDiscount,
      hasCoupon,
      createdAt: group.createdAt,
      installments: group.installments,
      snapshotBankPercent: group.snapshotBankPercent,
      paidTotal: group.paidTotal,
      paidKnown: group.paidKnown,
      cancelledCount: group.cancelledCount,
      charged: chargedAmount(group),
    } satisfies FinancePurchase;
  });

  const totals = purchases.reduce(
    (acc, purchase) => {
      acc.gross += purchase.financialGross;
      acc.serviceFee += purchase.serviceFee;
      acc.bankFee += purchase.bankFee;
      acc.net += purchase.net;
      if (!purchase.isCourtesy && !purchase.isCancelled) acc.paid += purchase.ticketCount;
      if (purchase.isCourtesy) acc.courtesy += purchase.ticketCount;
      if (purchase.hasCoupon && !purchase.isCancelled) {
        acc.couponDiscount += purchase.couponDiscount;
        acc.couponCount += 1;
      }
      if (purchase.cancelledCount > 0) {
        acc.cancelledTickets += purchase.cancelledCount;
        acc.cancelledAmount +=
          purchase.ticketCount > 0
            ? purchase.charged * (purchase.cancelledCount / purchase.ticketCount)
            : purchase.charged;
      }
      return acc;
    },
    {
      gross: 0,
      serviceFee: 0,
      bankFee: 0,
      net: 0,
      paid: 0,
      courtesy: 0,
      couponDiscount: 0,
      couponCount: 0,
      cancelledTickets: 0,
      cancelledAmount: 0,
    }
  );

  const site = emptyChannel();
  const posChannel = emptyChannel();
  const posDetailed = fees?.posFeesDetailed;
  const brandValues = posDetailed?.brands ? Object.values(posDetailed.brands) : [];
  const posCreditBank =
    brandValues.length > 0
      ? brandValues.reduce((sum, brand) => sum + num(brand.credit?.bank), 0) / brandValues.length
      : 0;
  const posDebitBank =
    brandValues.length > 0
      ? brandValues.reduce((sum, brand) => sum + num(brand.debit?.bank), 0) / brandValues.length
      : 0;
  const posPixBank = num(posDetailed?.pix?.bank);
  const posCashBank = num(posDetailed?.cash?.bank);

  for (const purchase of purchases) {
    if (purchase.isCourtesy || purchase.isCancelled) continue;
    const totalFee = purchase.serviceFee + purchase.bankFee;
    if (purchase.isPos) {
      let rate = 0;
      if (purchase.method === 'pix') rate = posPixBank;
      else if (purchase.method === 'cash') rate = posCashBank;
      else if (purchase.method === 'credit_card') rate = posCreditBank;
      else if (purchase.method === 'debit') rate = posDebitBank;
      const bank = purchase.billableGross * (rate / 100);
      posChannel.count += purchase.ticketCount;
      posChannel.gross += purchase.billableGross;
      posChannel.bank += bank;
      posChannel.gate8 += Math.max(0, totalFee - bank);
      posChannel.net += purchase.net;
      if (purchase.method === 'pix') {
        posChannel.pix += purchase.billableGross;
        posChannel.pixCount += purchase.ticketCount;
      } else if (purchase.method === 'credit_card') {
        posChannel.credit_card += purchase.billableGross;
        posChannel.creditCount += purchase.ticketCount;
      } else if (purchase.method === 'debit') {
        posChannel.debit += purchase.billableGross;
        posChannel.debitCount += purchase.ticketCount;
      } else if (purchase.method === 'cash') {
        posChannel.cash += purchase.billableGross;
        posChannel.cashCount += purchase.ticketCount;
      }
    } else if (purchase.method === 'pix' || purchase.method === 'credit_card') {
      site.count += purchase.ticketCount;
      site.gross += purchase.financialGross;
      site.bank += purchase.bankFee;
      site.gate8 += purchase.serviceFee;
      site.net += purchase.net;
    }
  }

  return {
    producerMode,
    producerPercent,
    totals,
    site,
    pos: posChannel,
  };
}
