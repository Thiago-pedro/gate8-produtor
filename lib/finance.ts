import { getAccessToken } from '@/lib/auth';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/config';
import { callServerFn } from '@/lib/server-fn';

const FN_FEES = '915adb06b5a9905d31d0ef78f112185f447176a61bd89297229912ee0bb03e08';
const FN_NAMES = 'f3877e983691ad4a7c353fca36679bc8dabbc3dc422be300d3672f7038cf9a6c';
const FN_COUPONS = '62d3f0a1966c1677137c3679d30aeae1587abdbcc4fbbfb0fff44b8750c9f21e';

const PIX_BANK = 1.09;
const CREDIT_BANK = 5.09;
export const FINANCE_PAGE_SIZE = 10;

type Row = Record<string, unknown>;
type FeeSplit = { bank?: number; gate8?: number };

export type FinancePurchase = {
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
  createdAt: string | null;
  installments: number;
  snapshotBankPercent: number | null;
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
  purchases: FinancePurchase[];
  totals: {
    gross: number;
    serviceFee: number;
    bankFee: number;
    net: number;
    paid: number;
    courtesy: number;
    couponDiscount: number;
    couponCount: number;
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

export function paymentLabel(method: string | null, courtesy: boolean, cancelled: boolean) {
  if (cancelled) return 'Cancelado';
  if (courtesy || !method) return 'Cortesia';
  if (method === 'pix') return 'PIX';
  if (method === 'credit_card' || method === 'credit') return 'Cartão de Crédito';
  if (method === 'debit' || method === 'debit_card') return 'Cartão de Débito';
  if (method === 'cash') return 'Dinheiro';
  if (method === 'cashless') return 'Cashless';
  return method;
}

async function fetchTickets(eventId: string) {
  const id = encodeURIComponent(eventId);
  const purchaseSelects = [
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

async function fetchNames(ids: string[]) {
  if (ids.length === 0) return {} as Record<string, string>;
  try {
    const data = await callServerFn<{ names?: Record<string, string> }>(FN_NAMES, { ids });
    return data?.names ?? {};
  } catch {
    try {
      const rows = asRows(
        await rest(
          `profiles?select=id,full_name&id=in.(${ids.map((id) => encodeURIComponent(id)).join(',')})`
        )
      );
      const names: Record<string, string> = {};
      for (const row of rows) {
        const id = text(row.id);
        const name = text(row.full_name);
        if (id && name) names[id] = name;
      }
      return names;
    } catch {
      return {};
    }
  }
}

async function fetchCoupons(eventId: string) {
  try {
    return await callServerFn<{
      byPurchaseId?: Record<string, { code?: string; discount?: number }>;
      byOrderId?: Record<string, { code?: string; discount?: number }>;
    }>(FN_COUPONS, { event_id: eventId });
  } catch {
    return { byPurchaseId: {}, byOrderId: {} };
  }
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

  const creatorIds = [
    ...new Set(tickets.map((ticket) => text(ticket.created_by)).filter(Boolean)),
  ];
  const names = await fetchNames(creatorIds);
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
    const cancelled = text(ticket.status) === 'cancelled';
    const billable = courtesy || cancelled ? 0 : unit;
    const buyer =
      (ticket.created_by ? names[text(ticket.created_by)] : '') || text(ticket.holder_name) || '—';
    const coupon =
      (purchaseId ? coupons.byPurchaseId?.[purchaseId] : undefined) ??
      (purchase?.pagarme_order_id
        ? coupons.byOrderId?.[text(purchase.pagarme_order_id)]
        : undefined) ??
      null;
    const key = groupKey(ticket, purchase);
    const paidTotal = purchase?.total_amount != null ? num(purchase.total_amount) : null;
    const snapshot = purchase?.fee_snapshot && typeof purchase.fee_snapshot === 'object'
      ? (purchase.fee_snapshot as Row)
      : null;
    const current = groups.get(key);

    if (current) {
      if (!current.couponCode && coupon) {
        current.couponCode = coupon.code ?? null;
        current.couponDiscount = num(coupon.discount);
      }
      current.ticketCount += 1;
      current.gross += unit;
      current.billableGross += billable;
      if (!cancelled) current.isCancelled = false;
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
      createdAt: group.createdAt,
      installments: group.installments,
      snapshotBankPercent: group.snapshotBankPercent,
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
      if (purchase.couponCode && purchase.couponDiscount > 0 && !purchase.isCancelled) {
        acc.couponDiscount += purchase.couponDiscount;
        acc.couponCount += 1;
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
    purchases,
    totals,
    site,
    pos: posChannel,
  };
}
