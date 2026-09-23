import { callServerFn } from '@/lib/server-fn';

const FN = {
  conveniences: 'd82ee90b8b50396bc17e4c3c69aacf5f8fe36c27d3e5fdbbcedc540a9c6f4540',
  createConv: '992f8dccc6e49f1902b24282f800c0fbeac81ad422089905522a8e742a6b8365',
  archiveConv: '5eda0ca9fc3bc2bd846f03d6031bfd2cab1b3d4ac9cf4bcb361b5e4f48be7977',
  deleteConv: '050dfed0243fe317dd9f5f66f5eadf7b993a277b22b6932153ecff2be6946972',
  updateConv: '65fde1745e8ab8a3857043ae49e682cdab16e8e55c851895bbe1fd9f9db3d8c3',
  regenToken: '44854a5f508f00f3d9d69cce4f7dbacc7be1f32515f3312b033e3bfd25a5abf8',
  devices: 'c617c104f9bf1d8dd2f3d63fee520729bd70e3728f7138e5354c4c014ce083f4',
  deviceStatus: 'e3352b0b0cd164bfbb7e2a63b1865d6c7730b35b4a779356c2e86e7cf343147e',
  deleteDevice: 'c0d2b16f6d4c6a1e0e2d671643e40737128d80c1e223041dd7438174b61d03a7',
  sales: 'faff3ebc65c00d51f5c4136fe3d669312366a2b7dbb7ebb0c8e76e29a2abba37',
  salesSummary: '07c32cc9ab5c1c87617a39afefefe5a97fa16e325a52c2cac22fa6bdb22104de',
  cashier: '814ced5af5324c9479900c79122883b990c93bec8662f8cdeebf212773bc6bdb',
  products: '105bd799834984b4d533484ae120c8f03d361753aa41664da451add3201a5b37',
  saveProduct: 'e9f746c4a33a0841ac407095ff39bd471de40ff288bb1bbea5ee7cd47763ef80',
  deleteProduct: '2131fd5ddeb040197c48c1a3face8b710339682c5210b67a28a925d16ae0ceec',
  stock: 'aded2057e63c12db39ad2639d45043ab4cfa7b651e732c3590eab770a37c0f46',
  cashless: 'f67c7899c5ae36dcd27ca919b258be387b8590cde45ea4c77d95dcb3be8c9a35',
  cashlessSave: '341516717292f55a94db313da713333e999127b58c3840efcb5016870dcaab9f',
  cashlessUpdate: 'a34fa4805eb82a71652372233ccaf69eee7c131d89f9cb0c93e312e0e2723de5',
  cashlessDelete: '14b746862f420ae6699ef34962e1d353ead52cf4b426609231dd80655bfc376d',
  cashlessMove: 'e35a3b7fb399ed4dbbd21f22289b6551613b6eece8e9b4cdd7b648f639d49757',
  cashlessTx: '76c26130932606e87570a47dbf30f1cc79f7895db8e7f3a2573b4b782065bb4a',
} as const;

type Row = Record<string, unknown>;

export type PdvDevice = {
  id: string;
  name: string;
  status: string;
  lastSeenAt: string | null;
};

export type PdvConvenience = {
  id: string;
  name: string;
  token: string | null;
  merchantName: string | null;
  archived: boolean;
};

export type PdvSale = {
  id: string;
  amount: number;
  method: string;
  status: string;
  createdAt: string | null;
  deviceName: string;
  operator: string | null;
  authorization: string;
  nsu: string;
  items: string[];
  voided: boolean;
};

export type PdvSalesSummary = {
  saleCount: number;
  gross: number;
  bank: number;
  gate8: number;
  net: number;
  byMethod: { method: string; count: number; amount: number }[];
};

export type PdvCashierSession = {
  id: string;
  deviceId: string;
  deviceName: string;
  status: string;
  openedAt: string | null;
  closedAt: string | null;
  openingBalance: number;
  counted: number | null;
  expected: number | null;
  difference: number | null;
  cashSales: number;
  withdrawals: number;
  expenses: number;
};

export type PdvProduct = {
  id: string;
  name: string;
  category: string | null;
  sku: string | null;
  price: number;
  cost: number;
  active: boolean;
  trackStock: boolean;
  stock: number;
  minStock: number;
  description: string | null;
  convenienceId: string | null;
};

export type PdvCard = {
  id: string;
  uid: string;
  holder: string;
  cpf: string | null;
  phone: string | null;
  status: string;
  balance: number;
  retired: boolean;
};

export type PdvCardTx = {
  id: string;
  type: string;
  amount: number;
  createdAt: string | null;
  description: string | null;
};

export const PAYMENT_LABELS: Record<string, string> = {
  pix: 'Pix',
  credit: 'Crédito',
  credit_card: 'Crédito',
  debit: 'Débito',
  cash: 'Dinheiro',
  cashless: 'Cashless',
  other: 'Outro',
};

export const CASHLESS_TX_LABELS: Record<string, string> = {
  topup: 'Recarga',
  consumption: 'Consumo',
  refund: 'Estorno',
  adjust: 'Ajuste',
  block: 'Cartão bloqueado',
  unblock: 'Cartão desbloqueado',
  transfer_out: 'Saldo transferido',
  transfer_in: 'Saldo recebido',
};

function text(value: unknown) {
  return value == null ? '' : String(value);
}

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asObject(value: unknown): Row | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Row;
  return null;
}

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

function pick(raw: unknown, key: string): unknown {
  const root = asObject(raw);
  if (!root) return null;
  if (root[key] != null) return root[key];
  const nested = asObject(root.data);
  return nested?.[key] ?? null;
}

function mapDevice(row: Row): PdvDevice {
  return {
    id: text(row.id),
    name: text(row.name) || 'Maquininha',
    status: text(row.status) || 'active',
    lastSeenAt: row.last_seen_at ? text(row.last_seen_at) : null,
  };
}

function mapConvenience(row: Row): PdvConvenience {
  return {
    id: text(row.id),
    name: text(row.name) || 'Conveniência',
    token: row.pos_token ? text(row.pos_token) : null,
    merchantName: row.pos_merchant_name ? text(row.pos_merchant_name) : null,
    archived: Boolean(row.archived_at),
  };
}

export function lastHoursRange(hours: number) {
  const to = new Date();
  const from = new Date(to.getTime() - hours * 3600 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export async function fetchConveniences(): Promise<PdvConvenience[]> {
  const raw = await callServerFn<unknown>(FN.conveniences, {});
  return asRows(pick(raw, 'conveniences')).map(mapConvenience).filter((item) => item.id);
}

export async function createConvenience(name: string, merchantName: string) {
  const raw = asObject(
    await callServerFn<unknown>(FN.createConv, {
      name: name.trim(),
      pos_merchant_name: merchantName.trim() || null,
    })
  );
  const nested = asObject(raw?.convenience) ?? asObject(asObject(raw?.data)?.convenience) ?? raw;
  return nested ? mapConvenience(nested) : null;
}

export async function archiveConvenience(id: string, archived: boolean) {
  await callServerFn(FN.archiveConv, { id, archived });
}

export async function deleteConvenience(id: string, name: string) {
  await callServerFn(FN.deleteConv, { id, name });
}

export async function updateConvenience(id: string, patch: { name?: string; merchantName?: string | null }) {
  await callServerFn(FN.updateConv, {
    id,
    ...(patch.name != null ? { name: patch.name } : {}),
    ...(patch.merchantName !== undefined ? { pos_merchant_name: patch.merchantName } : {}),
  });
}

export async function regenerateToken(id: string) {
  await callServerFn(FN.regenToken, { id });
}

export async function fetchDevices(convenienceId: string): Promise<PdvDevice[]> {
  const raw = await callServerFn<unknown>(FN.devices, { convenience_id: convenienceId });
  return asRows(pick(raw, 'devices')).map(mapDevice);
}

export async function setDeviceStatus(id: string, status: 'active' | 'disabled') {
  await callServerFn(FN.deviceStatus, { id, status });
}

export async function deleteDevice(id: string) {
  await callServerFn(FN.deleteDevice, { id });
}

function mapSaleItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      const row = asObject(item);
      return row ? text(row.description) || text(row.name) || text(row.product_name) : '';
    })
    .filter(Boolean);
}

function mapSale(row: Row): PdvSale {
  const status = text(row.status).toLowerCase();
  return {
    id: text(row.id),
    amount: num(row.total_amount ?? row.amount ?? row.gross ?? row.total),
    method: text(row.payment_method ?? row.method),
    status,
    createdAt: row.created_at ? text(row.created_at) : null,
    deviceName: text(asObject(row.device)?.name) || text(row.device_name) || '—',
    operator: row.operator_name
      ? text(row.operator_name)
      : row.cashier_name
        ? text(row.cashier_name)
        : null,
    authorization: text(row.acquirer_authorization ?? row.stone_authorization) || '—',
    nsu: text(row.acquirer_nsu ?? row.stone_nsu) || '—',
    items: mapSaleItems(row.items ?? row.line_items),
    voided: ['voided', 'refunded', 'canceled', 'cancelled', 'reversed'].includes(status),
  };
}

export async function fetchSales(input: {
  convenienceId: string;
  from: string;
  to: string;
  deviceId?: string | null;
  paymentMethod?: string | null;
}): Promise<PdvSale[]> {
  const raw = await callServerFn<unknown>(FN.sales, {
    from: input.from,
    to: input.to,
    device_id: input.deviceId || null,
    payment_method: input.paymentMethod || null,
    convenience_id: input.convenienceId,
    limit: 200,
  });
  return asRows(pick(raw, 'sales')).map(mapSale);
}

export async function fetchSalesSummary(input: {
  convenienceId: string;
  from: string;
  to: string;
  deviceId?: string | null;
}): Promise<PdvSalesSummary> {
  const raw = await callServerFn<unknown>(FN.salesSummary, {
    from: input.from,
    to: input.to,
    device_id: input.deviceId || null,
    convenience_id: input.convenienceId,
  });
  const summary = asObject(pick(raw, 'summary')) ?? asObject(raw) ?? {};
  const methods = asRows(summary.by_payment_method ?? pick(raw, 'by_payment_method'));
  return {
    saleCount: num(summary.sale_count),
    gross: num(summary.gross_total),
    bank: num(summary.bank_total),
    gate8: num(summary.gate8_total),
    net: num(summary.net_total),
    byMethod: methods.map((row) => ({
      method: text(row.method),
      count: num(row.count),
      amount: num(row.amount ?? row.total ?? row.gross),
    })),
  };
}

export async function fetchCashierSessions(
  convenienceId: string,
  status: 'all' | 'open' | 'closed'
): Promise<PdvCashierSession[]> {
  const raw = await callServerFn<unknown>(FN.cashier, {
    status,
    limit: 200,
    convenience_id: convenienceId,
  });
  return asRows(pick(raw, 'sessions')).map((row) => {
    const device = asObject(row.device);
    const totals = asObject(row.totals);
    const expected = row.expected_drawer ?? row.expected ?? totals?.expected;
    const counted = row.counted_balance ?? row.closing_balance ?? row.counted;
    const difference =
      row.difference != null
        ? num(row.difference)
        : counted != null && expected != null
          ? num(counted) - num(expected)
          : null;
    return {
      id: text(row.id),
      deviceId: text(row.device_id ?? device?.id),
      deviceName: text(device?.name) || 'Maquininha',
      status: text(row.status) || (row.closed_at ? 'closed' : 'open'),
      openedAt: row.opened_at ? text(row.opened_at) : null,
      closedAt: row.closed_at ? text(row.closed_at) : null,
      openingBalance: num(row.opening_balance),
      counted: counted == null ? null : num(counted),
      expected: expected == null ? null : num(expected),
      difference,
      cashSales: num(totals?.cash_sales),
      withdrawals: num(totals?.withdrawals),
      expenses: num(totals?.expenses),
    };
  });
}

export async function fetchProducts(convenienceId: string): Promise<PdvProduct[]> {
  const raw = await callServerFn<unknown>(FN.products, { mine: true });
  return asRows(pick(raw, 'products'))
    .map((row) => ({
      id: text(row.id),
      name: text(row.name) || 'Item',
      category: row.category ? text(row.category) : null,
      sku: row.sku ? text(row.sku) : null,
      price: num(row.price),
      cost: num(row.cost),
      active: row.active !== false,
      trackStock: Boolean(row.track_stock),
      stock: num(row.stock_quantity),
      minStock: num(row.min_stock),
      description: row.description ? text(row.description) : null,
      convenienceId: row.convenience_id ? text(row.convenience_id) : null,
    }))
    .filter((item) => item.convenienceId === convenienceId);
}

export async function saveProduct(
  convenienceId: string,
  product: {
    id?: string;
    name: string;
    description?: string;
    sku?: string;
    category?: string;
    price: number;
    cost: number;
    active: boolean;
    trackStock: boolean;
    stock: number;
    minStock: number;
  }
) {
  await callServerFn(FN.saveProduct, {
    id: product.id,
    event_id: null,
    convenience_id: convenienceId,
    name: product.name.trim(),
    description: product.description?.trim() || '',
    sku: product.sku?.trim() || '',
    category: product.category?.trim() || '',
    price: product.price,
    cost: product.cost,
    active: product.active,
    track_stock: product.trackStock,
    stock_quantity: product.trackStock ? product.stock : 0,
    min_stock: product.trackStock ? product.minStock : 0,
    image_url: '',
  });
}

export async function deleteProduct(id: string) {
  await callServerFn(FN.deleteProduct, { id });
}

export async function moveStock(productId: string, delta: number, inbound: boolean) {
  await callServerFn(FN.stock, {
    product_id: productId,
    delta: inbound ? Math.abs(delta) : -Math.abs(delta),
    reason: inbound ? 'entrada manual' : 'saída manual',
  });
}

export async function fetchCashless(
  convenienceId: string,
  search?: string
): Promise<{ cards: PdvCard[]; count: number; active: number; balance: number }> {
  const raw = await callServerFn<unknown>(FN.cashless, {
    convenience_id: convenienceId,
    event_id: null,
    search: search || null,
  });
  const totals = asObject(pick(raw, 'totals')) ?? {};
  const cards = asRows(pick(raw, 'cards')).map((row) => ({
    id: text(row.id),
    uid: text(row.card_uid),
    holder: text(row.holder_name) || 'Sem nome',
    cpf: row.cpf ? text(row.cpf) : null,
    phone: row.phone ? text(row.phone) : null,
    status: text(row.status) || 'active',
    balance: num(row.balance),
    retired: Boolean(row.retired_at),
  }));
  return {
    cards,
    count: num(totals.count) || cards.length,
    active: num(totals.active) || cards.filter((card) => card.status === 'active' && !card.retired).length,
    balance: num(totals.balance),
  };
}

export async function saveCashlessCard(input: {
  id?: string;
  convenienceId: string;
  uid: string;
  holder: string;
  cpf: string;
  phone: string;
}) {
  await callServerFn(FN.cashlessSave, {
    id: input.id,
    convenience_id: input.convenienceId,
    event_id: null,
    card_uid: input.uid.trim(),
    holder_name: input.holder.trim() || null,
    cpf: input.cpf.trim(),
    phone: input.phone.trim(),
  });
}

export async function setCashlessStatus(id: string, status: 'active' | 'blocked') {
  await callServerFn(FN.cashlessUpdate, { id, status });
}

export async function deleteCashlessCard(id: string) {
  await callServerFn(FN.cashlessDelete, { card_id: id });
}

export async function moveCashless(input: {
  cardId: string;
  type: 'topup' | 'consumption' | 'refund' | 'adjust';
  amount: number;
  description?: string;
}) {
  await callServerFn(FN.cashlessMove, {
    card_id: input.cardId,
    type: input.type,
    amount: input.amount,
    description: input.description || null,
  });
}

export async function fetchCashlessTx(cardId: string): Promise<PdvCardTx[]> {
  const raw = await callServerFn<unknown>(FN.cashlessTx, { card_id: cardId });
  return asRows(pick(raw, 'transactions')).map((row) => ({
    id: text(row.id),
    type: text(row.type),
    amount: num(row.amount),
    createdAt: row.created_at ? text(row.created_at) : null,
    description: row.description ? text(row.description) : null,
  }));
}
