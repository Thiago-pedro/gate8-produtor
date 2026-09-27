import { getAccessToken, getAuthUser } from '@/lib/auth';
import { siteUrl } from '@/constants/theme';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/config';
import { callServerFn } from '@/lib/server-fn';

const FN_FEES = '915adb06b5a9905d31d0ef78f112185f447176a61bd89297229912ee0bb03e08';
const FN_BALANCE = 'db6470b0b3c1e894af962ea601173dbc6073da264ad479b50fbc1c25cd166eb4';
const PIX_BANK = 1.09;
const CREDIT_BANK = 5.09;
const ZONE = 'America/Sao_Paulo';

type Row = Record<string, unknown>;
type FeeSplit = { bank?: number; gate8?: number };

export type BalanceCompany = {
  name: string | null;
  registeredName: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  address: string;
};

export type BalanceSalesItem = {
  id: string;
  type: 'sales';
  occurredAt: string;
  day: string;
  salesCount: number;
  ticketCount: number;
  gross: number;
  fees: number;
  net: number;
  balanceAfter: number;
};

export type BalanceWithdrawalItem = {
  id: string;
  type: 'withdrawal';
  occurredAt: string;
  amount: number;
  status: string;
  notes: string | null;
  balanceAfter: number;
};

export type BalanceRefundItem = {
  id: string;
  type: 'refund';
  occurredAt: string;
  amount: number;
  ticketCount: number;
  purchaseCode: string | null;
  buyerName: string | null;
  balanceAfter: number;
};

export type BalanceTimelineItem = BalanceSalesItem | BalanceWithdrawalItem | BalanceRefundItem;

export type BalanceResponse = {
  eventName: string;
  startsAt: string;
  endsAt: string;
  company: BalanceCompany | null;
  summary: {
    gross: number;
    fees: number;
    net: number;
    withdrawnPaid: number;
    withdrawnPending: number;
    refunded: number;
    available: number;
  };
  timeline: BalanceTimelineItem[];
};

const CANCELLED = [
  'cancelled',
  'canceled',
  'refunded',
  'refund',
  'void',
  'reversed',
  'estornado',
  'chargedback',
];

function money(value: number) {
  return Number(value.toFixed(2));
}

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function text(value: unknown) {
  return value == null ? '' : String(value);
}

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

function asObject(value: unknown): Row | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : null;
}

function nested(row: Row, key: string): Row | null {
  const value = row[key];
  if (Array.isArray(value) && value[0] && typeof value[0] === 'object') return value[0] as Row;
  if (value && typeof value === 'object') return value as Row;
  return null;
}

function isCancelled(value: unknown) {
  return CANCELLED.includes(text(value).trim().toLowerCase());
}

async function headers() {
  const token = await getAccessToken();
  if (!token) throw new Error('Faça login para continuar.');
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

function apiError(status: number, raw: unknown, fallback: string) {
  if (status === 401) return new Error('Faça login para continuar.');
  if (status === 403) return new Error('Você não tem acesso a este evento.');
  if (status === 404) return new Error('Evento não encontrado.');
  if (raw && typeof raw === 'object') {
    const body = raw as { message?: unknown; error?: unknown };
    const nested =
      typeof body.error === 'object' && body.error
        ? (body.error as { message?: unknown }).message
        : body.error;
    const message = body.message || nested;
    if (typeof message === 'string' && message.trim()) return new Error(message);
  }
  return new Error(fallback);
}

async function rest<T>(path: string): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: await headers() });
  const raw = await response.text();
  const body = raw ? (JSON.parse(raw) as unknown) : null;
  if (!response.ok) throw apiError(response.status, body, 'Não foi possível carregar o balanço.');
  return body as T;
}

async function firstRest(paths: string[]): Promise<Row[]> {
  for (const path of paths) {
    try {
      return asRows(await rest(path));
    } catch {
      // tenta o próximo select
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

function saoPauloDay(iso: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function looksLikeBalance(value: unknown): value is BalanceResponse {
  const row = asObject(value);
  const nested = asObject(row?.data) ?? row;
  if (!nested) return false;
  return Boolean(asObject(nested.summary) && Array.isArray(nested.timeline));
}

function normalizeBalance(value: unknown): BalanceResponse | null {
  if (!looksLikeBalance(value)) return null;
  const row = asObject(value);
  const nested = (asObject(row?.data) ?? row) as Row;
  const summary = asObject(nested.summary) ?? {};
  const company = asObject(nested.company);
  return {
    eventName: text(nested.eventName || nested.event_name),
    startsAt: text(nested.startsAt || nested.starts_at),
    endsAt: text(nested.endsAt || nested.ends_at),
    company: company
      ? {
          name: company.name ? text(company.name) : null,
          registeredName: company.registeredName || company.registered_name
            ? text(company.registeredName ?? company.registered_name)
            : null,
          document: company.document ? text(company.document) : null,
          email: company.email ? text(company.email) : null,
          phone: company.phone ? text(company.phone) : null,
          address: text(company.address),
        }
      : null,
    summary: {
      gross: money(num(summary.gross)),
      fees: money(num(summary.fees)),
      net: money(num(summary.net)),
      withdrawnPaid: money(num(summary.withdrawnPaid ?? summary.withdrawn_paid)),
      withdrawnPending: money(num(summary.withdrawnPending ?? summary.withdrawn_pending)),
      refunded: money(num(summary.refunded)),
      available: money(num(summary.available)),
    },
    timeline: asRows(nested.timeline).map(mapTimelineItem).filter(Boolean) as BalanceTimelineItem[],
  };
}

function mapTimelineItem(row: Row): BalanceTimelineItem | null {
  const type = text(row.type);
  const occurredAt = text(row.occurredAt || row.occurred_at);
  const balanceAfter = money(num(row.balanceAfter ?? row.balance_after));
  if (type === 'sales') {
    return {
      id: text(row.id),
      type: 'sales',
      occurredAt,
      day: text(row.day) || saoPauloDay(occurredAt),
      salesCount: num(row.salesCount ?? row.sales_count),
      ticketCount: num(row.ticketCount ?? row.ticket_count),
      gross: money(num(row.gross)),
      fees: money(num(row.fees)),
      net: money(num(row.net)),
      balanceAfter,
    };
  }
  if (type === 'withdrawal') {
    return {
      id: text(row.id),
      type: 'withdrawal',
      occurredAt,
      amount: money(num(row.amount)),
      status: text(row.status),
      notes: row.notes ? text(row.notes) : null,
      balanceAfter,
    };
  }
  if (type === 'refund') {
    return {
      id: text(row.id),
      type: 'refund',
      occurredAt,
      amount: money(num(row.amount)),
      ticketCount: num(row.ticketCount ?? row.ticket_count),
      purchaseCode: row.purchaseCode || row.purchase_code ? text(row.purchaseCode ?? row.purchase_code) : null,
      buyerName: row.buyerName || row.buyer_name ? text(row.buyerName ?? row.buyer_name) : null,
      balanceAfter,
    };
  }
  return null;
}

async function fetchOfficialEndpoint(eventId: string): Promise<BalanceResponse | null> {
  try {
    for (const payload of [{ eventId }, { event_id: eventId }]) {
      try {
        const viaFn = await callServerFn<unknown>(FN_BALANCE, payload);
        const normalized = normalizeBalance(viaFn);
        if (normalized) return normalized;
      } catch (caught) {
        if (caught instanceof Error && /login|acesso/i.test(caught.message)) throw caught;
      }
    }
  } catch (caught) {
    if (caught instanceof Error && /login|acesso/i.test(caught.message)) throw caught;
  }

  const token = await getAccessToken();
  if (!token) throw new Error('Faça login para continuar.');
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-gate8-client': 'app',
  };
  const urls: { url: string; method: 'GET' | 'POST'; body?: string }[] = [
    { url: `${siteUrl}/api/public/app/producer/balance?eventId=${encodeURIComponent(eventId)}`, method: 'GET' },
    {
      url: `${siteUrl}/api/public/app/producer/balance`,
      method: 'POST',
      body: JSON.stringify({ eventId, event_id: eventId }),
    },
    { url: `${siteUrl}/api/producer/events/${encodeURIComponent(eventId)}/balance`, method: 'GET' },
    {
      url: `${siteUrl}/api/producer/events/${encodeURIComponent(eventId)}/balance`,
      method: 'POST',
      body: JSON.stringify({ eventId }),
    },
  ];

  for (const spec of urls) {
    try {
      const response = await fetch(spec.url, {
        method: spec.method,
        headers,
        body: spec.body,
      });
      if (response.status === 404 || response.status === 405) continue;
      const raw = await response.text();
      let parsed: unknown = raw;
      try {
        parsed = raw ? JSON.parse(raw) : {};
      } catch {
        continue;
      }
      if (response.status === 401 || response.status === 403) throw apiError(response.status, parsed, '');
      if (!response.ok) continue;
      const normalized = normalizeBalance(parsed);
      if (normalized) return normalized;
    } catch (caught) {
      if (caught instanceof Error && /login|acesso/i.test(caught.message)) throw caught;
    }
  }
  return null;
}

async function fetchFees(eventId: string) {
  try {
    return await callServerFn<{
      percent?: number;
      producerPercent?: number;
      siteFeesDetailed?: { pix?: FeeSplit; credit?: FeeSplit };
      posFees?: { credit?: number; debit?: number; pix?: number };
    }>(FN_FEES, { eventId }, { method: 'GET', auth: false });
  } catch {
    return null;
  }
}

function splitFrom(value: unknown): FeeSplit {
  const row = asObject(value);
  if (!row) return {};
  return { bank: num(row.bank), gate8: num(row.gate8) };
}

function ticketPrice(ticket: Row, batches: Map<string, Row>, tables: Map<string, Row>) {
  const batchId = text(ticket.batch_id);
  const batch = (batchId ? batches.get(batchId) : null) ?? nested(ticket, 'batch') ?? nested(ticket, 'ticket_batches');
  if (batch) return num(batch.price);
  const direct = num(ticket.unit_price ?? ticket.price ?? ticket.ticket_price);
  if (direct > 0) return direct;
  const tableId = text(ticket.table_id);
  if (tableId) {
    const table = tables.get(tableId);
    if (table) {
      const seats = num(ticket.seat_total) || num(table.seats) || 1;
      return seats > 0 ? num(table.price) / seats : 0;
    }
  }
  return 0;
}

function couponForPurchase(intents: Row[], purchaseId: string) {
  for (const intent of intents) {
    if (text(intent.purchase_id) === purchaseId) return Math.max(0, num(intent.coupon_discount));
    const ids = intent.materialized_purchase_ids;
    if (Array.isArray(ids) && ids.some((id) => text(id) === purchaseId)) {
      return Math.max(0, num(intent.coupon_discount));
    }
  }
  return 0;
}

function companyAddress(row: Row) {
  return [row.address, row.number, row.neighborhood, row.city, row.state, row.cep]
    .map((item) => text(item).trim())
    .filter(Boolean)
    .join(', ');
}

async function buildFromOfficialTables(eventId: string): Promise<BalanceResponse> {
  const user = await getAuthUser();
  if (!user?.id) throw new Error('Faça login para continuar.');
  const id = encodeURIComponent(eventId);

  const eventRows = await firstRest([
    `events?select=id,name,created_at,created_by,producer_fee_percent,site_fees_override,pos_fees_override&id=eq.${id}`,
    `events?select=id,name,created_at,created_by&id=eq.${id}`,
  ]);
  const event = eventRows[0];
  if (!event) throw new Error('Evento não encontrado.');

  const [tickets, batchRows, tableRows, posRows, intentRows, withdrawalRows, refundRows, fees, profileRows] =
    await Promise.all([
      pagedRest([
        `tickets?select=id,status,payment_method,created_at,batch_id,table_id,seat_total,purchase_id,unit_price,price&event_id=eq.${id}&order=created_at.asc`,
        `tickets?select=id,status,payment_method,created_at,batch_id,table_id,seat_total,purchase_id&event_id=eq.${id}&order=created_at.asc`,
      ]),
      firstRest([
        `ticket_batches?select=id,price,event_id&event_id=eq.${id}`,
        `ticket_batches?select=id,price&event_id=eq.${id}`,
      ]),
      firstRest([
        `event_tables?select=id,price,seats&event_id=eq.${id}`,
      ]),
      firstRest([
        `pos_sale_items?select=ticket_id,ticket:tickets!inner(event_id,purchase_id)&ticket.event_id=eq.${id}&ticket_id=not.is.null`,
        `pos_sale_items?select=ticket_id,purchase_id&event_id=eq.${id}`,
      ]),
      firstRest([
        `purchase_intents?select=coupon_discount,materialized_purchase_ids,purchase_id&event_id=eq.${id}`,
        `purchase_intents?select=coupon_discount,materialized_purchase_ids&event_id=eq.${id}`,
      ]),
      firstRest([
        `withdrawal_requests?select=id,status,amount_net,created_at,paid_at,notes&event_id=eq.${id}&order=created_at.asc`,
      ]),
      firstRest([
        `refund_logs?select=id,created_at,amount,ticket_count,purchase_code,buyer_name&event_id=eq.${id}&order=created_at.asc`,
      ]),
      fetchFees(eventId),
      firstRest([
        `producer_profiles?select=name,registered_name,legal_name,document,cpf_cnpj,email,phone,address,number,neighborhood,city,state,cep&user_id=eq.${encodeURIComponent(user.id)}`,
        `producer_profiles?select=name,registered_name,document,email,phone,address&id=eq.${encodeURIComponent(user.id)}`,
      ]),
    ]);

  const purchaseIds = [...new Set(tickets.map((row) => text(row.purchase_id)).filter(Boolean))];
  const purchaseRows = await (async () => {
    const selects = [
      'id,code,created_at,total_amount,fee_snapshot,status',
      'id,code,created_at,total_amount,fee_snapshot',
      'id,code,created_at,total_amount,status',
      'id,code,created_at,total_amount',
    ];
    const unique = [...new Set(purchaseIds)];
    const rows: Row[] = [];
    for (let index = 0; index < unique.length; index += 80) {
      const chunk = unique
        .slice(index, index + 80)
        .map((item) => encodeURIComponent(item))
        .join(',');
      if (!chunk) continue;
      rows.push(
        ...(await firstRest(selects.map((select) => `purchase_orders?select=${select}&id=in.(${chunk})`)))
      );
    }
    return rows;
  })();
  const purchasesById = new Map(purchaseRows.map((row) => [text(row.id), row]));
  const batchesById = new Map(batchRows.map((row) => [text(row.id), row]));
  const tables = new Map(tableRows.map((row) => [text(row.id), row]));
  const posTicketIds = new Set<string>();
  const posPurchaseIds = new Set<string>();
  for (const row of posRows) {
    const ticketId = text(row.ticket_id);
    if (ticketId) posTicketIds.add(ticketId);
    const ticket = nested(row, 'ticket') ?? nested(row, 'tickets');
    const purchaseId = text(ticket?.purchase_id ?? row.purchase_id);
    if (purchaseId) posPurchaseIds.add(purchaseId);
  }

  const siteOverride = asObject(event.site_fees_override);
  const posOverride = asObject(event.pos_fees_override);
  const pixSplit = splitFrom(siteOverride?.pix) ;
  const creditSplit = splitFrom(siteOverride?.credit);
  const pixBank = num(pixSplit.bank) || num(fees?.siteFeesDetailed?.pix?.bank) || PIX_BANK;
  const pixGate8 = num(pixSplit.gate8) || num(fees?.siteFeesDetailed?.pix?.gate8);
  const creditBank = num(creditSplit.bank) || num(fees?.siteFeesDetailed?.credit?.bank) || CREDIT_BANK;
  const creditGate8 = num(creditSplit.gate8) || num(fees?.siteFeesDetailed?.credit?.gate8);
  const producerPercent = num(event.producer_fee_percent) || num(fees?.producerPercent);
  const posPix = num(posOverride?.pix) || num(fees?.posFees?.pix);
  const posCredit = num(posOverride?.credit) || num(fees?.posFees?.credit);
  const posDebit = num(posOverride?.debit) || num(fees?.posFees?.debit);

  type Purchase = {
    id: string;
    method: string;
    createdAt: string;
    isPos: boolean;
    ticketCount: number;
    activeTickets: number;
    nominal: number;
    couponDiscount: number;
    totalAmount: number;
    snapshotBank: number;
    snapshotGate8: number;
    snapshotNet: number | null;
    snapshotKnown: boolean;
  };

  const purchases = new Map<string, Purchase>();
  for (const ticket of tickets) {
    const purchaseId = text(ticket.purchase_id);
    const method = text(ticket.payment_method);
    if (!purchaseId || !method) continue;
    const purchase = purchasesById.get(purchaseId) ?? nested(ticket, 'purchase') ?? nested(ticket, 'purchase_orders');
    const createdAt =
      text(purchase?.created_at) || text(ticket.created_at) || new Date().toISOString();
    const current = purchases.get(purchaseId);
    const cancelled = isCancelled(ticket.status) || isCancelled(purchase?.status);
    const unit = ticketPrice(ticket, batchesById, tables);
    if (current) {
      current.ticketCount += 1;
      current.activeTickets += cancelled ? 0 : 1;
      current.nominal += unit;
      if (posTicketIds.has(text(ticket.id))) current.isPos = true;
      continue;
    }
    const snapshot = asObject(purchase?.fee_snapshot);
    purchases.set(purchaseId, {
      id: purchaseId,
      method,
      createdAt,
      isPos: posTicketIds.has(text(ticket.id)) || posPurchaseIds.has(purchaseId),
      ticketCount: 1,
      activeTickets: cancelled ? 0 : 1,
      nominal: unit,
      couponDiscount: couponForPurchase(intentRows, purchaseId),
      totalAmount: purchase?.total_amount != null ? num(purchase.total_amount) : 0,
      snapshotBank: snapshot ? num(snapshot.bank_amount) : 0,
      snapshotGate8: snapshot ? num(snapshot.gate8_amount) : 0,
      snapshotNet: snapshot && snapshot.net_amount != null ? num(snapshot.net_amount) : null,
      snapshotKnown: Boolean(
        snapshot &&
          (snapshot.bank_amount != null || snapshot.gate8_amount != null || snapshot.net_amount != null)
      ),
    });
  }

  function settle(purchase: Purchase) {
    const discounted = money(Math.max(0, purchase.nominal - purchase.couponDiscount));
    if (purchase.isPos) {
      let rate = 0;
      if (purchase.method === 'pix') rate = posPix;
      else if (purchase.method === 'credit_card') rate = posCredit;
      else if (purchase.method === 'debit') rate = posDebit;
      const feesValue = money(discounted * (rate / 100));
      return { gross: discounted, fees: feesValue, net: money(discounted - feesValue) };
    }
    const paid = purchase.totalAmount > 0;
    if (purchase.snapshotKnown) {
      const gross = paid ? money(purchase.totalAmount) : discounted;
      const feesValue = money(purchase.snapshotBank + purchase.snapshotGate8);
      const net =
        purchase.snapshotNet != null ? money(purchase.snapshotNet) : money(gross - feesValue);
      return { gross, fees: feesValue, net };
    }
    const extra = paid ? Math.max(0, money(purchase.totalAmount - discounted)) : null;
    const gross = paid ? money(purchase.totalAmount) : discounted;
    let bank = 0;
    let gate8 = 0;
    if (producerPercent > 0) {
      gate8 = money(discounted * (producerPercent / 100));
      if (purchase.method === 'pix') bank = money(purchase.nominal * (pixBank / 100));
      else if (purchase.method === 'credit_card') bank = money(purchase.nominal * (creditBank / 100));
    } else if (purchase.method === 'pix') {
      bank = money(purchase.nominal * (pixBank / 100));
      gate8 = extra != null ? money(Math.max(0, extra - bank)) : money(discounted * (pixGate8 / 100));
    } else if (purchase.method === 'credit_card') {
      bank = money(purchase.nominal * (creditBank / 100));
      gate8 = extra != null ? money(Math.max(0, extra - bank)) : money(discounted * (creditGate8 / 100));
    }
    const feesValue = extra != null ? extra : money(bank + gate8);
    return { gross, fees: feesValue, net: money(gross - feesValue) };
  }

  const settled = Array.from(purchases.values()).map((purchase) => ({
    purchase,
    ...settle(purchase),
  }));

  const active = settled.filter((item) => item.purchase.activeTickets > 0);
  const gross = money(active.reduce((sum, item) => sum + item.gross, 0));
  const feesTotal = money(active.reduce((sum, item) => sum + item.fees, 0));
  const net = money(active.reduce((sum, item) => sum + item.net, 0));

  const withdrawals = withdrawalRows.map((row) => ({
    id: text(row.id),
    status: text(row.status) || 'pending',
    amount: money(num(row.amount_net)),
    notes: row.notes ? text(row.notes) : null,
    occurredAt:
      text(row.status) === 'paid'
        ? text(row.paid_at) || text(row.created_at)
        : text(row.created_at),
  }));
  const withdrawnPaid = money(
    withdrawals.filter((item) => item.status === 'paid').reduce((sum, item) => sum + item.amount, 0)
  );
  const withdrawnPending = money(
    withdrawals.filter((item) => item.status === 'pending').reduce((sum, item) => sum + item.amount, 0)
  );

  const refunds = refundRows.map((row) => ({
    id: text(row.id) || `refund-${text(row.created_at)}`,
    occurredAt: text(row.created_at),
    amount: money(num(row.amount)),
    ticketCount: num(row.ticket_count),
    purchaseCode: row.purchase_code ? text(row.purchase_code) : null,
    buyerName: row.buyer_name ? text(row.buyer_name) : null,
  }));
  const refunded = money(refunds.reduce((sum, item) => sum + item.amount, 0));
  const available = money(net - withdrawnPaid - withdrawnPending);

  const days = new Map<
    string,
    { occurredAt: string; salesCount: number; ticketCount: number; gross: number; fees: number; net: number }
  >();
  for (const item of active) {
    const day = saoPauloDay(item.purchase.createdAt);
    const current = days.get(day);
    if (current) {
      current.salesCount += 1;
      current.ticketCount += item.purchase.ticketCount;
      current.gross = money(current.gross + item.gross);
      current.fees = money(current.fees + item.fees);
      current.net = money(current.net + item.net);
      if (item.purchase.createdAt < current.occurredAt) current.occurredAt = item.purchase.createdAt;
    } else {
      days.set(day, {
        occurredAt: item.purchase.createdAt,
        salesCount: 1,
        ticketCount: item.purchase.ticketCount,
        gross: item.gross,
        fees: item.fees,
        net: item.net,
      });
    }
  }

  type Movement =
    | { sort: string; kind: 'sales'; day: string; data: NonNullable<ReturnType<typeof days.get>> }
    | { sort: string; kind: 'withdrawal'; data: (typeof withdrawals)[number] }
    | { sort: string; kind: 'refund'; data: (typeof refunds)[number] };

  const movements: Movement[] = [
    ...Array.from(days.entries()).map(([day, data]) => ({
      sort: data.occurredAt,
      kind: 'sales' as const,
      day,
      data,
    })),
    ...withdrawals
      .filter((item) => item.occurredAt)
      .map((item) => ({ sort: item.occurredAt, kind: 'withdrawal' as const, data: item })),
    ...refunds
      .filter((item) => item.occurredAt)
      .map((item) => ({ sort: item.occurredAt, kind: 'refund' as const, data: item })),
  ].sort((left, right) => left.sort.localeCompare(right.sort));

  let saldo = 0;
  const timeline: BalanceTimelineItem[] = [];
  for (const movement of movements) {
    if (movement.kind === 'sales') {
      saldo = money(saldo + movement.data.net);
      timeline.push({
        id: `sales-${movement.day}`,
        type: 'sales',
        occurredAt: movement.data.occurredAt,
        day: movement.day,
        salesCount: movement.data.salesCount,
        ticketCount: movement.data.ticketCount,
        gross: movement.data.gross,
        fees: movement.data.fees,
        net: movement.data.net,
        balanceAfter: saldo,
      });
    } else if (movement.kind === 'withdrawal') {
      if (movement.data.status === 'paid') saldo = money(saldo - movement.data.amount);
      timeline.push({
        id: `wd-${movement.data.id}`,
        type: 'withdrawal',
        occurredAt: movement.data.occurredAt,
        amount: movement.data.amount,
        status: movement.data.status,
        notes: movement.data.notes,
        balanceAfter: saldo,
      });
    } else {
      saldo = money(saldo - movement.data.amount);
      timeline.push({
        id: movement.data.id,
        type: 'refund',
        occurredAt: movement.data.occurredAt,
        amount: movement.data.amount,
        ticketCount: movement.data.ticketCount,
        purchaseCode: movement.data.purchaseCode,
        buyerName: movement.data.buyerName,
        balanceAfter: saldo,
      });
    }
  }

  const profile = profileRows[0];
  const now = new Date().toISOString();
  return {
    eventName: text(event.name),
    startsAt: text(event.created_at) || now,
    endsAt: now,
    company: profile
      ? {
          name: profile.name ? text(profile.name) : null,
          registeredName: profile.registered_name || profile.legal_name
            ? text(profile.registered_name ?? profile.legal_name)
            : null,
          document: profile.document || profile.cpf_cnpj ? text(profile.document ?? profile.cpf_cnpj) : null,
          email: profile.email ? text(profile.email) : null,
          phone: profile.phone ? text(profile.phone) : null,
          address: companyAddress(profile),
        }
      : null,
    summary: {
      gross,
      fees: feesTotal,
      net,
      withdrawnPaid,
      withdrawnPending,
      refunded,
      available,
    },
    timeline,
  };
}

export async function fetchEventBalance(eventId: string): Promise<BalanceResponse> {
  const official = await fetchOfficialEndpoint(eventId);
  if (official) {
    const salesBroken = official.timeline.some(
      (item) => item.type === 'sales' && item.salesCount > 0 && item.net === 0 && item.gross === 0
    );
    if (!salesBroken) return official;
  }
  return buildFromOfficialTables(eventId);
}
