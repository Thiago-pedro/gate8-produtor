import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Loader } from '@/components/Loader';
import { colors } from '@/constants/theme';
import { formatBRL, formatDateTime, formatEventDateTime } from '@/lib/format';
import {
  CASHLESS_TX_LABELS,
  PAYMENT_LABELS,
  archiveConvenience,
  createConvenience,
  deleteCashlessCard,
  deleteConvenience,
  deleteDevice,
  deleteProduct,
  fetchCashierSessions,
  fetchCashless,
  fetchCashlessTx,
  fetchConveniences,
  fetchDevices,
  fetchProducts,
  fetchSales,
  fetchSalesSummary,
  lastHoursRange,
  moveCashless,
  moveStock,
  regenerateToken,
  saveCashlessCard,
  saveProduct,
  setCashlessStatus,
  setDeviceStatus,
  updateConvenience,
  type PdvCard,
  type PdvCashierSession,
  type PdvConvenience,
  type PdvDevice,
  type PdvProduct,
  type PdvSale,
  type PdvSalesSummary,
} from '@/lib/pdv';

type Tab = 'devices' | 'sales' | 'cashier' | 'items' | 'cashless';

const TABS: { key: Tab; label: string }[] = [
  { key: 'devices', label: 'Maquininhas' },
  { key: 'sales', label: 'Vendas POS' },
  { key: 'cashier', label: 'Caixas' },
  { key: 'items', label: 'Meus itens' },
  { key: 'cashless', label: 'Cashless' },
];

export function PdvSection({
  nonce,
  onCopy,
  onToast,
}: {
  nonce: number;
  onCopy: (value: string, message: string) => void;
  onToast: (message: string) => void;
}) {
  const [list, setList] = useState<PdvConvenience[] | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archived, setArchived] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMerchant, setNewMerchant] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<PdvConvenience | null>(null);
  const [deleteName, setDeleteName] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const rows = await fetchConveniences();
      setList(rows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar o Terminal PDV.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, nonce]);

  const visible = (list ?? []).filter((item) => (archived ? item.archived : !item.archived));
  const opened = (list ?? []).find((item) => item.id === openId) ?? null;
  const archivedCount = (list ?? []).filter((item) => item.archived).length;

  async function onCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const created = await createConvenience(newName, newMerchant);
      onToast('Conveniência criada');
      setNewName('');
      setNewMerchant('');
      setCreating(false);
      const rows = await fetchConveniences();
      setList(rows);
      if (created?.id) setOpenId(created.id);
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : 'Falha ao criar');
    } finally {
      setSaving(false);
    }
  }

  if (busy && !list) {
    return (
      <View style={styles.boot}>
        <Loader size={148} />
      </View>
    );
  }
  if (error && !list) return <Text style={styles.empty}>{error}</Text>;

  if (opened) {
    return (
      <PdvDetail
        convenience={opened}
        nonce={nonce}
        onBack={() => setOpenId(null)}
        onCopy={onCopy}
        onToast={onToast}
        onReload={async () => {
          const rows = await fetchConveniences();
          setList(rows);
        }}
      />
    );
  }

  return (
    <View style={styles.block}>
      <Text style={styles.hint}>
        Cada conveniência tem suas próprias maquininhas, vendas, caixas e itens — nada se mistura entre uma e outra.
      </Text>
      <View style={styles.rowBetween}>
        <Text style={styles.group}>
          {archived ? 'Conveniências arquivadas' : 'Suas conveniências'} ({visible.length})
        </Text>
        {archivedCount > 0 ? (
          <Pressable onPress={() => setArchived((value) => !value)} style={styles.linkBtn}>
            <Text style={styles.linkText}>{archived ? 'Ativas' : `Arquivadas (${archivedCount})`}</Text>
          </Pressable>
        ) : null}
      </View>

      {!creating ? (
        <Pressable onPress={() => setCreating(true)} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
          <Ionicons name="add" size={16} color={colors.loginText} />
          <Text style={styles.primaryText}>Nova conveniência</Text>
        </Pressable>
      ) : (
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Nome da conveniência</Text>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Ex: Conveniência Arraiá 2026"
            placeholderTextColor="rgba(255,255,255,0.32)"
            style={styles.input}
            maxLength={120}
          />
          <Text style={styles.fieldLabel}>Nome do estabelecimento (CNPJ) — opcional</Text>
          <TextInput
            value={newMerchant}
            onChangeText={setNewMerchant}
            placeholder="Aparece na maquininha. Pode deixar em branco."
            placeholderTextColor="rgba(255,255,255,0.32)"
            style={styles.input}
            maxLength={120}
          />
          <View style={styles.row}>
            <Pressable
              onPress={() => {
                setCreating(false);
                setNewName('');
                setNewMerchant('');
              }}
              style={styles.ghostBtn}
            >
              <Text style={styles.ghostText}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={() => void onCreate()}
              disabled={!newName.trim() || saving}
              style={[styles.primaryBtn, (!newName.trim() || saving) && styles.off]}
            >
              <Text style={styles.primaryText}>Criar</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Modal visible={!!deleting} transparent animationType="fade" onRequestClose={() => setDeleting(null)}>
        <Pressable style={styles.modalBg} onPress={() => setDeleting(null)}>
          <Pressable style={styles.modal} onPress={() => undefined}>
            <Text style={styles.modalTitle}>Excluir conveniência?</Text>
            <Text style={styles.modalText}>
              Digite o nome {deleting ? `"${deleting.name}"` : ''} para confirmar. Esta ação não pode ser desfeita.
            </Text>
            <TextInput
              value={deleteName}
              onChangeText={setDeleteName}
              placeholder="Nome da conveniência"
              placeholderTextColor="rgba(255,255,255,0.32)"
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setDeleting(null)} style={styles.ghostBtn}>
                <Text style={styles.ghostText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  if (!deleting) return;
                  try {
                    await deleteConvenience(deleting.id, deleteName.trim());
                    onToast('Conveniência excluída');
                    setDeleting(null);
                    setDeleteName('');
                    await load();
                  } catch (caught) {
                    onToast(caught instanceof Error ? caught.message : 'Falha ao excluir');
                  }
                }}
                disabled={!deleting || deleteName.trim() !== deleting.name}
                style={[styles.primaryBtn, (!deleting || deleteName.trim() !== deleting.name) && styles.off]}
              >
                <Text style={styles.primaryText}>Excluir</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {visible.length === 0 ? (
        <Text style={styles.empty}>
          {archived ? 'Nenhuma conveniência arquivada.' : 'Nenhuma conveniência ainda. Crie a primeira para começar.'}
        </Text>
      ) : (
        visible.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            {item.merchantName ? <Text style={styles.meta}>{item.merchantName}</Text> : null}
            {item.token ? <Text style={styles.tokenMini}>{item.token}</Text> : null}
            <View style={styles.row}>
              {item.archived ? (
                <>
                  <Pressable
                    onPress={async () => {
                      try {
                        await archiveConvenience(item.id, false);
                        onToast('Restaurada');
                        await load();
                      } catch (caught) {
                        onToast(caught instanceof Error ? caught.message : 'Falha ao restaurar');
                      }
                    }}
                    style={styles.ghostBtn}
                  >
                    <Text style={styles.ghostText}>Restaurar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setDeleting(item);
                      setDeleteName('');
                    }}
                    style={styles.ghostBtn}
                  >
                    <Text style={[styles.ghostText, { color: colors.danger }]}>Excluir</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable onPress={() => setOpenId(item.id)} style={styles.primaryBtn}>
                    <Text style={styles.primaryText}>Abrir</Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      try {
                        await archiveConvenience(item.id, true);
                        onToast('Arquivada');
                        await load();
                      } catch (caught) {
                        onToast(caught instanceof Error ? caught.message : 'Falha ao arquivar');
                      }
                    }}
                    style={styles.ghostBtn}
                  >
                    <Text style={styles.ghostText}>Arquivar</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function PdvDetail({
  convenience,
  nonce,
  onBack,
  onCopy,
  onToast,
  onReload,
}: {
  convenience: PdvConvenience;
  nonce: number;
  onBack: () => void;
  onCopy: (value: string, message: string) => void;
  onToast: (message: string) => void;
  onReload: () => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>('devices');
  const [name, setName] = useState(convenience.name);
  const [merchant, setMerchant] = useState(convenience.merchantName ?? '');
  const [savingName, setSavingName] = useState(false);
  const [savingMerchant, setSavingMerchant] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);

  useEffect(() => {
    setName(convenience.name);
    setMerchant(convenience.merchantName ?? '');
  }, [convenience.id, convenience.name, convenience.merchantName]);

  return (
    <View style={styles.block}>
      <Pressable onPress={onBack} style={styles.backRow}>
        <Ionicons name="chevron-back" size={18} color={colors.blue} />
        <Text style={styles.linkText}>Conveniências</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Token desta conveniência (use em cada maquininha)</Text>
        <Pressable
          onPress={() => convenience.token && onCopy(convenience.token, 'Copiado')}
          style={styles.tokenBox}
        >
          <Text style={styles.token}>{convenience.token || '—'}</Text>
        </Pressable>
        <View style={styles.row}>
          <Pressable
            onPress={() => convenience.token && onCopy(convenience.token, 'Copiado')}
            style={styles.ghostBtn}
          >
            <Ionicons name="copy-outline" size={14} color={colors.blue} />
            <Text style={styles.ghostText}>Copiar</Text>
          </Pressable>
          <Pressable onPress={() => setRegenOpen(true)} style={styles.ghostBtn}>
            <Ionicons name="refresh" size={14} color={colors.text} />
            <Text style={styles.ghostText}>Novo token</Text>
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>Nome da conveniência</Text>
        <View style={styles.amountRow}>
          <TextInput value={name} onChangeText={setName} style={styles.input} maxLength={120} />
          {name.trim() && name.trim() !== convenience.name ? (
            <Pressable
              onPress={async () => {
                setSavingName(true);
                try {
                  await updateConvenience(convenience.id, { name: name.trim() });
                  onToast('Nome da conveniência salvo');
                  await onReload();
                } catch (caught) {
                  onToast(caught instanceof Error ? caught.message : 'Falha ao salvar');
                } finally {
                  setSavingName(false);
                }
              }}
              style={styles.ghostBtn}
            >
              <Text style={styles.ghostText}>{savingName ? '...' : 'Salvar'}</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.fieldLabel}>Nome do estabelecimento — usado nas vendas do PDV</Text>
        <View style={styles.amountRow}>
          <TextInput
            value={merchant}
            onChangeText={setMerchant}
            placeholder="Ex: Zahir Produções"
            placeholderTextColor="rgba(255,255,255,0.32)"
            style={styles.input}
            maxLength={120}
          />
          {(merchant.trim() || '') !== (convenience.merchantName ?? '') ? (
            <Pressable
              onPress={async () => {
                setSavingMerchant(true);
                try {
                  await updateConvenience(convenience.id, { merchantName: merchant.trim() || null });
                  onToast('Nome do estabelecimento salvo');
                  await onReload();
                } catch (caught) {
                  onToast(caught instanceof Error ? caught.message : 'Falha ao salvar');
                } finally {
                  setSavingMerchant(false);
                }
              }}
              style={styles.ghostBtn}
            >
              <Text style={styles.ghostText}>{savingMerchant ? '...' : 'Salvar'}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.subTabs}>
        {TABS.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setTab(item.key)}
            style={[styles.subTab, tab === item.key && styles.subTabOn]}
          >
            <Text style={[styles.subTabText, tab === item.key && styles.subTabTextOn]} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'devices' ? (
        <DevicesPane convenienceId={convenience.id} nonce={nonce} onToast={onToast} />
      ) : null}
      {tab === 'sales' ? <SalesPane convenienceId={convenience.id} nonce={nonce} /> : null}
      {tab === 'cashier' ? <CashierPane convenienceId={convenience.id} nonce={nonce} /> : null}
      {tab === 'items' ? <ItemsPane convenienceId={convenience.id} nonce={nonce} onToast={onToast} /> : null}
      {tab === 'cashless' ? (
        <CashlessPane convenienceId={convenience.id} nonce={nonce} onToast={onToast} />
      ) : null}

      <Modal visible={regenOpen} transparent animationType="fade" onRequestClose={() => setRegenOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setRegenOpen(false)}>
          <Pressable style={styles.modal} onPress={() => undefined}>
            <Text style={styles.modalTitle}>Gerar novo token?</Text>
            <Text style={styles.modalText}>
              As maquininhas desta conveniência precisarão entrar novamente com o token novo.
            </Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setRegenOpen(false)} style={styles.ghostBtn}>
                <Text style={styles.ghostText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  setRegenOpen(false);
                  try {
                    await regenerateToken(convenience.id);
                    onToast('Token renovado');
                    await onReload();
                  } catch (caught) {
                    onToast(caught instanceof Error ? caught.message : 'Falha ao gerar token');
                  }
                }}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryText}>Gerar novo</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function DevicesPane({
  convenienceId,
  nonce,
  onToast,
}: {
  convenienceId: string;
  nonce: number;
  onToast: (message: string) => void;
}) {
  const [devices, setDevices] = useState<PdvDevice[] | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setDevices(await fetchDevices(convenienceId));
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : 'Falha ao carregar maquininhas');
    } finally {
      setBusy(false);
    }
  }, [convenienceId, onToast]);

  useEffect(() => {
    void load();
  }, [load, nonce]);

  if (busy && !devices) {
    return (
      <View style={styles.miniBoot}>
        <Loader size={96} />
      </View>
    );
  }

  const active = (devices ?? []).filter((item) => item.status !== 'disabled');
  const disabled = (devices ?? []).filter((item) => item.status === 'disabled');

  return (
    <View style={styles.gap}>
      <Text style={styles.group}>Liberadas ({active.length})</Text>
      {active.length === 0 ? <Text style={styles.empty}>Nenhuma maquininha liberada ainda.</Text> : null}
      {active.map((device) => (
        <DeviceRow
          key={device.id}
          device={device}
          onToast={onToast}
          onReload={load}
        />
      ))}
      {disabled.length > 0 ? (
        <>
          <Text style={styles.group}>Desativadas ({disabled.length})</Text>
          {disabled.map((device) => (
            <DeviceRow key={device.id} device={device} onToast={onToast} onReload={load} />
          ))}
        </>
      ) : null}
    </View>
  );
}

function DeviceRow({
  device,
  onToast,
  onReload,
}: {
  device: PdvDevice;
  onToast: (message: string) => void;
  onReload: () => Promise<void>;
}) {
  const off = device.status === 'disabled';
  const [confirm, setConfirm] = useState(false);
  return (
    <View style={styles.hit}>
      <View style={styles.hitInfo}>
        <Text style={styles.deviceName}>{device.name}</Text>
        <Text style={styles.meta}>
          {device.lastSeenAt ? `Visto ${formatDateTime(device.lastSeenAt)}` : 'Nunca conectada'}
        </Text>
      </View>
      <Text style={[styles.badge, off ? styles.badgeOff : styles.badgeOn]}>{off ? 'Desativado' : 'Ativado'}</Text>
      <Pressable
        onPress={async () => {
          try {
            await setDeviceStatus(device.id, off ? 'active' : 'disabled');
            await onReload();
          } catch (caught) {
            onToast(caught instanceof Error ? caught.message : 'Falha ao atualizar');
          }
        }}
        style={styles.ghostBtn}
      >
        <Text style={styles.ghostText}>{off ? 'Reativar' : 'Desativar'}</Text>
      </Pressable>
      <Pressable onPress={() => setConfirm(true)}>
        <Ionicons name="trash-outline" size={16} color={colors.danger} />
      </Pressable>
      <Modal visible={confirm} transparent animationType="fade" onRequestClose={() => setConfirm(false)}>
        <Pressable style={styles.modalBg} onPress={() => setConfirm(false)}>
          <Pressable style={styles.modal} onPress={() => undefined}>
            <Text style={styles.modalTitle}>Excluir maquininha?</Text>
            <Text style={styles.modalText}>{device.name} será removida permanentemente.</Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setConfirm(false)} style={styles.ghostBtn}>
                <Text style={styles.ghostText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  setConfirm(false);
                  try {
                    await deleteDevice(device.id);
                    onToast('Maquininha excluída permanentemente.');
                    await onReload();
                  } catch (caught) {
                    onToast(caught instanceof Error ? caught.message : 'Falha ao excluir');
                  }
                }}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryText}>Excluir</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function DateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date;
  onChange: (next: Date) => void;
}) {
  const [open, setOpen] = useState<'date' | 'time' | 'datetime' | null>(null);
  const [draft, setDraft] = useState(value);

  function start() {
    setDraft(value);
    setOpen(Platform.OS === 'ios' ? 'datetime' : 'date');
  }

  function onPick(event: DateTimePickerEvent, selected?: Date) {
    if (event.type === 'dismissed') {
      setOpen(null);
      return;
    }
    const next = selected ?? draft;
    setDraft(next);
    if (Platform.OS === 'ios') return;
    if (open === 'date') {
      setOpen('time');
      return;
    }
    setOpen(null);
    onChange(next);
  }

  return (
    <View style={styles.gap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable onPress={start} style={styles.dateBtn}>
        <Ionicons name="calendar-outline" size={16} color={colors.blue} />
        <Text style={styles.dateText}>{formatEventDateTime(value.toISOString())}</Text>
      </Pressable>
      {open ? (
        <View>
          <DateTimePicker
            value={draft}
            mode={open}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            is24Hour
            onChange={onPick}
          />
          {Platform.OS === 'ios' ? (
            <Pressable
              onPress={() => {
                onChange(draft);
                setOpen(null);
              }}
              style={styles.dateOk}
            >
              <Text style={styles.linkText}>Confirmar</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function SalesPane({ convenienceId, nonce }: { convenienceId: string; nonce: number }) {
  const [period, setPeriod] = useState<24 | 168 | 720 | 'custom'>(24);
  const [customFrom, setCustomFrom] = useState(() => new Date(Date.now() - 24 * 3600 * 1000));
  const [customTo, setCustomTo] = useState(() => new Date());
  const [method, setMethod] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [devices, setDevices] = useState<PdvDevice[]>([]);
  const [query, setQuery] = useState('');
  const [sales, setSales] = useState<PdvSale[]>([]);
  const [summary, setSummary] = useState<PdvSalesSummary | null>(null);
  const [busy, setBusy] = useState(true);
  const [page, setPage] = useState(0);
  const range = useMemo(() => {
    if (period !== 'custom') return lastHoursRange(period);
    const from = customFrom.getTime() <= customTo.getTime() ? customFrom : customTo;
    const to = customFrom.getTime() <= customTo.getTime() ? customTo : customFrom;
    return { from: from.toISOString(), to: to.toISOString() };
  }, [period, customFrom, customTo]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [rows, totals, machineList] = await Promise.all([
        fetchSales({
          convenienceId,
          from: range.from,
          to: range.to,
          deviceId: deviceId || null,
          paymentMethod: method || null,
        }),
        fetchSalesSummary({ convenienceId, from: range.from, to: range.to, deviceId: deviceId || null }),
        fetchDevices(convenienceId),
      ]);
      setSales(rows);
      setSummary(totals);
      setDevices(machineList);
      setPage(0);
    } catch {
      setSales([]);
      setSummary(null);
    } finally {
      setBusy(false);
    }
  }, [convenienceId, range.from, range.to, method, deviceId]);

  useEffect(() => {
    void load();
  }, [load, nonce]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sales;
    return sales.filter((sale) => {
      const hay = [
        sale.authorization,
        sale.nsu,
        sale.deviceName,
        sale.operator ?? '',
        sale.items.join(' '),
        String(sale.amount),
        formatBRL(sale.amount),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [sales, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  const current = Math.min(page, pages - 1);
  const paged = filtered.slice(current * 8, current * 8 + 8);

  return (
    <View style={styles.gap}>
      <View style={styles.periodRow}>
        {(
          [
            [24, '24h'],
            [168, '7d'],
            [720, '30d'],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={String(value)}
            onPress={() => setPeriod(value)}
            style={[styles.chip, styles.periodChip, period === value && styles.chipOn]}
          >
            <Text style={[styles.chipText, period === value && styles.chipTextOn]}>{label}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setPeriod('custom')}
          style={[styles.chip, styles.periodChip, period === 'custom' && styles.chipOn]}
        >
          <Text style={[styles.chipText, period === 'custom' && styles.chipTextOn]}>Personalizado</Text>
        </Pressable>
      </View>
      {period === 'custom' ? (
        <View style={styles.card}>
          <DateTimeField label="De" value={customFrom} onChange={setCustomFrom} />
          <DateTimeField label="Até" value={customTo} onChange={setCustomTo} />
        </View>
      ) : null}
      <View style={styles.chips}>
        {[
          ['', 'Todos'],
          ['pix', 'Pix'],
          ['credit', 'Crédito'],
          ['debit', 'Débito'],
          ['cash', 'Dinheiro'],
          ['cashless', 'Cashless'],
        ].map(([value, label]) => (
          <Pressable
            key={value || 'all'}
            onPress={() => setMethod(value)}
            style={[styles.chip, method === value && styles.chipOn]}
          >
            <Text style={[styles.chipText, method === value && styles.chipTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {devices.length > 0 ? (
        <View style={styles.chips}>
          <Pressable onPress={() => setDeviceId('')} style={[styles.chip, !deviceId && styles.chipOn]}>
            <Text style={[styles.chipText, !deviceId && styles.chipTextOn]}>Todas as maquininhas</Text>
          </Pressable>
          {devices.map((device) => (
            <Pressable
              key={device.id}
              onPress={() => setDeviceId(device.id)}
              style={[styles.chip, deviceId === device.id && styles.chipOn]}
            >
              <Text style={[styles.chipText, deviceId === device.id && styles.chipTextOn]} numberOfLines={1}>
                {device.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <TextInput
        value={query}
        onChangeText={(value) => {
          setQuery(value);
          setPage(0);
        }}
        placeholder="Buscar AUT, NSU, item ou valor"
        placeholderTextColor="rgba(255,255,255,0.32)"
        style={styles.input}
      />

      {busy && !summary ? (
        <View style={styles.miniBoot}>
          <Loader size={96} />
        </View>
      ) : (
        <>
          {summary ? (
            <View style={styles.kpis}>
              <Kpi label="Vendas" value={String(summary.saleCount)} />
              <Kpi label="Bruto" value={formatBRL(summary.gross)} />
              <Kpi label="Taxa banco" value={formatBRL(summary.bank)} />
              <Kpi label="Taxa Gate8" value={formatBRL(summary.gate8)} />
              <Kpi label="Líquido" value={formatBRL(summary.net)} accent />
            </View>
          ) : null}
          {summary?.byMethod.length ? (
            <View style={styles.card}>
              <Text style={styles.group}>Vendas por forma de pagamento</Text>
              {summary.byMethod.map((item) => (
                <View key={item.method} style={styles.line}>
                  <Text style={styles.meta}>
                    {PAYMENT_LABELS[item.method] ?? item.method} · {item.count}
                  </Text>
                  <Text style={styles.meta}>{formatBRL(item.amount)}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {paged.map((sale) => (
            <View key={sale.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.name}>{formatBRL(sale.amount)}</Text>
                <View style={styles.row}>
                  <Text style={styles.badge}>{PAYMENT_LABELS[sale.method] ?? sale.method}</Text>
                  {sale.voided ? <Text style={[styles.badge, styles.badgeDanger]}>Estornada</Text> : null}
                </View>
              </View>
              <Text style={styles.meta}>{formatDateTime(sale.createdAt) || '—'}</Text>
              <Text style={styles.meta}>
                Local {sale.deviceName}
                {sale.operator ? ` · ${sale.operator}` : ''}
              </Text>
              <Text style={styles.meta}>Aut. {sale.authorization} · NSU {sale.nsu}</Text>
              {sale.items.length ? <Text style={styles.meta}>Itens {sale.items.join(', ')}</Text> : null}
            </View>
          ))}
          {filtered.length === 0 ? <Text style={styles.empty}>Nenhuma venda neste período.</Text> : null}
          {filtered.length > 8 ? (
            <View style={styles.rowBetween}>
              <Text style={styles.meta}>
                Página {current + 1} de {pages}
              </Text>
              <View style={styles.row}>
                <Pressable onPress={() => setPage(current - 1)} disabled={current === 0} style={styles.ghostBtn}>
                  <Text style={styles.ghostText}>Anterior</Text>
                </Pressable>
                <Pressable
                  onPress={() => setPage(current + 1)}
                  disabled={current >= pages - 1}
                  style={styles.ghostBtn}
                >
                  <Text style={styles.ghostText}>Próxima</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={[styles.kpi, accent && styles.kpiAccent]}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, accent && styles.linkText]}>{value}</Text>
    </View>
  );
}

function CashierPane({ convenienceId, nonce }: { convenienceId: string; nonce: number }) {
  const [status, setStatus] = useState<'all' | 'open' | 'closed'>('all');
  const [rows, setRows] = useState<PdvCashierSession[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setRows(await fetchCashierSessions(convenienceId, status));
    } catch {
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, [convenienceId, status]);

  useEffect(() => {
    void load();
  }, [load, nonce]);

  const grouped = useMemo(() => {
    const map = new Map<string, PdvCashierSession[]>();
    for (const row of rows) {
      const list = map.get(row.deviceId) ?? [];
      list.push(row);
      map.set(row.deviceId, list);
    }
    return [...map.entries()];
  }, [rows]);

  return (
    <View style={styles.gap}>
      <View style={styles.chips}>
        {(['all', 'open', 'closed'] as const).map((value) => (
          <Pressable
            key={value}
            onPress={() => setStatus(value)}
            style={[styles.chip, status === value && styles.chipOn]}
          >
            <Text style={[styles.chipText, status === value && styles.chipTextOn]}>
              {value === 'all' ? 'Todos' : value === 'open' ? 'Aberto' : 'Fechado'}
            </Text>
          </Pressable>
        ))}
      </View>
      {busy ? (
        <View style={styles.miniBoot}>
          <Loader size={96} />
        </View>
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>Nenhuma sessão de caixa encontrada.</Text>
      ) : (
        grouped.map(([deviceId, sessions]) => (
          <View key={deviceId} style={styles.gap}>
            <Text style={styles.group}>{sessions[0]?.deviceName}</Text>
            {sessions.map((session) => (
              <View key={session.id} style={styles.card}>
                <Text style={[styles.badge, session.status === 'open' ? styles.badgeOn : styles.badgeOff]}>
                  {session.status === 'open' ? 'aberto' : 'fechado'}
                </Text>
                <Text style={styles.meta}>Aberto {formatDateTime(session.openedAt) || '—'}</Text>
                <Text style={styles.meta}>Fechado {formatDateTime(session.closedAt) || '—'}</Text>
                <Text style={styles.meta}>
                  Troco {formatBRL(session.openingBalance)} →{' '}
                  {session.counted == null ? '—' : formatBRL(session.counted)}
                </Text>
                {session.expected != null ? (
                  <Text style={styles.meta}>Esperado: {formatBRL(session.expected)}</Text>
                ) : null}
                {session.cashSales ? (
                  <Text style={styles.meta}>
                    Vendas cash: {formatBRL(session.cashSales)}
                    {session.withdrawals > 0 ? ` · Sangria: ${formatBRL(session.withdrawals)}` : ''}
                    {session.expenses > 0 ? ` · Despesas: ${formatBRL(session.expenses)}` : ''}
                  </Text>
                ) : null}
                <Text style={styles.meta}>
                  Diferença {session.difference == null ? '—' : formatBRL(session.difference)}
                </Text>
              </View>
            ))}
          </View>
        ))
      )}
    </View>
  );
}

function ItemsPane({
  convenienceId,
  nonce,
  onToast,
}: {
  convenienceId: string;
  nonce: number;
  onToast: (message: string) => void;
}) {
  const [items, setItems] = useState<PdvProduct[]>([]);
  const [busy, setBusy] = useState(true);
  const [editing, setEditing] = useState<Partial<PdvProduct> | null>(null);
  const [stockItem, setStockItem] = useState<PdvProduct | null>(null);
  const [stockQty, setStockQty] = useState('');
  const [stockIn, setStockIn] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setItems(await fetchProducts(convenienceId));
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : 'Falha ao carregar itens');
    } finally {
      setBusy(false);
    }
  }, [convenienceId, onToast]);

  useEffect(() => {
    void load();
  }, [load, nonce]);

  return (
    <View style={styles.gap}>
      <Pressable
        onPress={() =>
          setEditing({
            name: '',
            price: 0,
            cost: 0,
            active: true,
            trackStock: false,
            stock: 0,
            minStock: 0,
          })
        }
        style={styles.primaryBtn}
      >
        <Ionicons name="add" size={16} color={colors.loginText} />
        <Text style={styles.primaryText}>Novo item</Text>
      </Pressable>
      {busy ? (
        <View style={styles.miniBoot}>
          <Loader size={96} />
        </View>
      ) : items.length === 0 ? (
        <Text style={styles.empty}>Nenhum item cadastrado para este evento.</Text>
      ) : (
        items.map((item) => (
          <View key={item.id} style={styles.hit}>
            <View style={styles.hitInfo}>
              <Text style={styles.deviceName}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.category || '—'} · {formatBRL(item.price)}
                {item.trackStock ? ` · estoque: ${item.stock}` : ''}
                {item.sku ? ` · SKU ${item.sku}` : ''}
              </Text>
            </View>
            {!item.active ? <Text style={styles.badge}>inativo</Text> : null}
            {item.trackStock && item.stock <= item.minStock ? (
              <Text style={[styles.badge, styles.badgeDanger]}>estoque baixo</Text>
            ) : null}
            {item.trackStock ? (
              <Pressable onPress={() => setStockItem(item)}>
                <Text style={styles.linkText}>±</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => setEditing(item)}>
              <Ionicons name="pencil" size={15} color={colors.blue} />
            </Pressable>
            <Pressable
              onPress={async () => {
                try {
                  await deleteProduct(item.id);
                  onToast('Item excluído');
                  await load();
                } catch (caught) {
                  onToast(caught instanceof Error ? caught.message : 'Falha ao excluir');
                }
              }}
            >
              <Ionicons name="trash-outline" size={15} color={colors.danger} />
            </Pressable>
          </View>
        ))
      )}

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.modalBg} onPress={() => setEditing(null)}>
          <Pressable style={styles.modal} onPress={() => undefined}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10 }}>
            <Text style={styles.modalTitle}>{editing?.id ? 'Editar item' : 'Novo item'}</Text>
            <TextInput
              value={editing?.name ?? ''}
              onChangeText={(value) => setEditing((current) => ({ ...current, name: value }))}
              placeholder="Nome"
              placeholderTextColor="rgba(255,255,255,0.32)"
              style={styles.input}
            />
            <TextInput
              value={editing?.category ?? ''}
              onChangeText={(value) => setEditing((current) => ({ ...current, category: value }))}
              placeholder="Categoria"
              placeholderTextColor="rgba(255,255,255,0.32)"
              style={styles.input}
            />
            <TextInput
              value={editing?.sku ?? ''}
              onChangeText={(value) => setEditing((current) => ({ ...current, sku: value }))}
              placeholder="SKU"
              placeholderTextColor="rgba(255,255,255,0.32)"
              style={styles.input}
            />
            <TextInput
              value={editing ? String(editing.price ?? '') : ''}
              onChangeText={(value) => setEditing((current) => ({ ...current, price: Number(value.replace(',', '.')) || 0 }))}
              placeholder="Preço (R$)"
              keyboardType="decimal-pad"
              placeholderTextColor="rgba(255,255,255,0.32)"
              style={styles.input}
            />
            <TextInput
              value={editing ? String(editing.cost ?? '') : ''}
              onChangeText={(value) => setEditing((current) => ({ ...current, cost: Number(value.replace(',', '.')) || 0 }))}
              placeholder="Custo (R$)"
              keyboardType="decimal-pad"
              placeholderTextColor="rgba(255,255,255,0.32)"
              style={styles.input}
            />
            <View style={styles.rowBetween}>
              <Text style={styles.meta}>Ativo</Text>
              <Switch
                value={editing?.active !== false}
                onValueChange={(value) => setEditing((current) => ({ ...current, active: value }))}
                trackColor={{ true: colors.blue }}
              />
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.meta}>Controlar estoque</Text>
              <Switch
                value={!!editing?.trackStock}
                onValueChange={(value) => setEditing((current) => ({ ...current, trackStock: value }))}
                trackColor={{ true: colors.blue }}
              />
            </View>
            {editing?.trackStock ? (
              <>
                <TextInput
                  value={String(editing.stock ?? 0)}
                  onChangeText={(value) => setEditing((current) => ({ ...current, stock: Number(value) || 0 }))}
                  placeholder="Estoque atual"
                  keyboardType="number-pad"
                  placeholderTextColor="rgba(255,255,255,0.32)"
                  style={styles.input}
                />
                <TextInput
                  value={String(editing.minStock ?? 0)}
                  onChangeText={(value) => setEditing((current) => ({ ...current, minStock: Number(value) || 0 }))}
                  placeholder="Estoque mínimo"
                  keyboardType="number-pad"
                  placeholderTextColor="rgba(255,255,255,0.32)"
                  style={styles.input}
                />
              </>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setEditing(null)} style={styles.ghostBtn}>
                <Text style={styles.ghostText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  if (!editing?.name?.trim()) return;
                  try {
                    await saveProduct(convenienceId, {
                      id: editing.id,
                      name: editing.name,
                      category: editing.category ?? '',
                      sku: editing.sku ?? '',
                      description: editing.description ?? '',
                      price: editing.price ?? 0,
                      cost: editing.cost ?? 0,
                      active: editing.active !== false,
                      trackStock: !!editing.trackStock,
                      stock: editing.stock ?? 0,
                      minStock: editing.minStock ?? 0,
                    });
                    onToast('Item salvo');
                    setEditing(null);
                    await load();
                  } catch (caught) {
                    onToast(caught instanceof Error ? caught.message : 'Falha ao salvar');
                  }
                }}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryText}>Salvar</Text>
              </Pressable>
            </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!stockItem} transparent animationType="fade" onRequestClose={() => setStockItem(null)}>
        <Pressable style={styles.modalBg} onPress={() => setStockItem(null)}>
          <Pressable style={styles.modal} onPress={() => undefined}>
            <Text style={styles.modalTitle}>Movimentar estoque</Text>
            <View style={styles.chips}>
              <Pressable onPress={() => setStockIn(true)} style={[styles.chip, stockIn && styles.chipOn]}>
                <Text style={[styles.chipText, stockIn && styles.chipTextOn]}>Entrada</Text>
              </Pressable>
              <Pressable onPress={() => setStockIn(false)} style={[styles.chip, !stockIn && styles.chipOn]}>
                <Text style={[styles.chipText, !stockIn && styles.chipTextOn]}>Saída</Text>
              </Pressable>
            </View>
            <TextInput
              value={stockQty}
              onChangeText={setStockQty}
              placeholder="Quantidade"
              keyboardType="number-pad"
              placeholderTextColor="rgba(255,255,255,0.32)"
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setStockItem(null)} style={styles.ghostBtn}>
                <Text style={styles.ghostText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  const qty = Number(stockQty);
                  if (!stockItem || !Number.isFinite(qty) || qty <= 0) return;
                  try {
                    await moveStock(stockItem.id, qty, stockIn);
                    onToast('Estoque atualizado');
                    setStockItem(null);
                    setStockQty('');
                    await load();
                  } catch (caught) {
                    onToast(caught instanceof Error ? caught.message : 'Falha no estoque');
                  }
                }}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryText}>Confirmar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function CashlessPane({
  convenienceId,
  nonce,
  onToast,
}: {
  convenienceId: string;
  nonce: number;
  onToast: (message: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [count, setCount] = useState(0);
  const [active, setActive] = useState(0);
  const [balance, setBalance] = useState(0);
  const [cards, setCards] = useState<PdvCard[]>([]);
  const [busy, setBusy] = useState(true);
  const [form, setForm] = useState<{ id?: string; uid: string; holder: string; cpf: string; phone: string } | null>(
    null
  );
  const [move, setMove] = useState<PdvCard | null>(null);
  const [moveType, setMoveType] = useState<'topup' | 'consumption' | 'refund' | 'adjust'>('topup');
  const [moveAmount, setMoveAmount] = useState('');
  const [history, setHistory] = useState<PdvCard | null>(null);
  const [txs, setTxs] = useState<{ id: string; type: string; amount: number; createdAt: string | null }[]>([]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const data = await fetchCashless(convenienceId, applied);
      setCards(data.cards);
      setCount(data.count);
      setActive(data.active);
      setBalance(data.balance);
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : 'Falha ao carregar cashless');
    } finally {
      setBusy(false);
    }
  }, [convenienceId, applied, onToast]);

  useEffect(() => {
    void load();
  }, [load, nonce]);

  return (
    <View style={styles.gap}>
      <View style={styles.kpis}>
        <Kpi label="Cartões cadastrados" value={String(count)} />
        <Kpi label="Cartões ativos" value={String(active)} />
        <Kpi label="Saldo em circulação" value={formatBRL(balance)} accent />
      </View>
      <View style={styles.amountRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar UID, nome, CPF..."
          placeholderTextColor="rgba(255,255,255,0.32)"
          style={styles.input}
          returnKeyType="search"
          onSubmitEditing={() => setApplied(search.trim())}
        />
        <Pressable onPress={() => setApplied(search.trim())} style={styles.ghostBtn}>
          <Text style={styles.ghostText}>Buscar</Text>
        </Pressable>
        <Pressable onPress={() => setForm({ uid: '', holder: '', cpf: '', phone: '' })} style={styles.primaryBtn}>
          <Text style={styles.primaryText}>Novo</Text>
        </Pressable>
      </View>
      {busy ? (
        <View style={styles.miniBoot}>
          <Loader size={96} />
        </View>
      ) : cards.length === 0 ? (
        <Text style={styles.empty}>Nenhum cartão cashless cadastrado ainda.</Text>
      ) : (
        cards.map((card) => (
          <View key={card.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.tokenMini}>{card.uid}</Text>
              <Text
                style={[
                  styles.badge,
                  card.retired ? styles.badgeOff : card.status === 'active' ? styles.badgeOn : styles.badgeOff,
                ]}
              >
                {card.retired ? 'Encerrado' : card.status === 'active' ? 'Ativo' : 'Bloqueado'}
              </Text>
            </View>
            <Text style={styles.name}>{card.holder}</Text>
            <Text style={styles.meta}>Saldo {formatBRL(card.balance)}</Text>
            {!card.retired ? (
              <View style={styles.row}>
                <Pressable
                  onPress={() =>
                    setForm({
                      id: card.id,
                      uid: card.uid,
                      holder: card.holder === 'Sem nome' ? '' : card.holder,
                      cpf: card.cpf ?? '',
                      phone: card.phone ?? '',
                    })
                  }
                  style={styles.ghostBtn}
                >
                  <Text style={styles.ghostText}>Editar</Text>
                </Pressable>
                <Pressable onPress={() => setMove(card)} style={styles.ghostBtn}>
                  <Text style={styles.ghostText}>Saldo</Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    setHistory(card);
                    try {
                      setTxs(await fetchCashlessTx(card.id));
                    } catch {
                      setTxs([]);
                    }
                  }}
                  style={styles.ghostBtn}
                >
                  <Text style={styles.ghostText}>Histórico</Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    try {
                      await setCashlessStatus(card.id, card.status === 'active' ? 'blocked' : 'active');
                      await load();
                    } catch (caught) {
                      onToast(caught instanceof Error ? caught.message : 'Falha ao atualizar');
                    }
                  }}
                  style={styles.ghostBtn}
                >
                  <Text style={styles.ghostText}>{card.status === 'active' ? 'Bloquear' : 'Desbloquear'}</Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    try {
                      await deleteCashlessCard(card.id);
                      onToast('Cartão excluído');
                      await load();
                    } catch (caught) {
                      onToast(caught instanceof Error ? caught.message : 'Falha ao excluir');
                    }
                  }}
                >
                  <Ionicons name="trash-outline" size={15} color={colors.danger} />
                </Pressable>
              </View>
            ) : null}
          </View>
        ))
      )}

      <Modal visible={!!form} transparent animationType="fade" onRequestClose={() => setForm(null)}>
        <Pressable style={styles.modalBg} onPress={() => setForm(null)}>
          <Pressable style={styles.modal} onPress={() => undefined}>
            <Text style={styles.modalTitle}>Cartão cashless</Text>
            <TextInput
              value={form?.uid ?? ''}
              onChangeText={(value) => setForm((current) => current && { ...current, uid: value })}
              placeholder="UID do cartão"
              placeholderTextColor="rgba(255,255,255,0.32)"
              style={styles.input}
            />
            <TextInput
              value={form?.holder ?? ''}
              onChangeText={(value) => setForm((current) => current && { ...current, holder: value })}
              placeholder="Nome do portador"
              placeholderTextColor="rgba(255,255,255,0.32)"
              style={styles.input}
            />
            <TextInput
              value={form?.cpf ?? ''}
              onChangeText={(value) => setForm((current) => current && { ...current, cpf: value })}
              placeholder="CPF"
              placeholderTextColor="rgba(255,255,255,0.32)"
              style={styles.input}
            />
            <TextInput
              value={form?.phone ?? ''}
              onChangeText={(value) => setForm((current) => current && { ...current, phone: value })}
              placeholder="Celular"
              placeholderTextColor="rgba(255,255,255,0.32)"
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setForm(null)} style={styles.ghostBtn}>
                <Text style={styles.ghostText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  if (!form?.uid.trim()) return;
                  try {
                    await saveCashlessCard({
                      id: form.id,
                      convenienceId,
                      uid: form.uid,
                      holder: form.holder,
                      cpf: form.cpf,
                      phone: form.phone,
                    });
                    onToast('Cartão salvo');
                    setForm(null);
                    await load();
                  } catch (caught) {
                    const message = caught instanceof Error ? caught.message : '';
                    onToast(
                      message.includes('uid_ja_cadastrado')
                        ? 'Este UID já está cadastrado nesta conveniência'
                        : message.includes('cpf_invalido')
                          ? 'CPF inválido'
                          : message.includes('celular_invalido')
                            ? 'Celular inválido'
                            : 'Não foi possível salvar'
                    );
                  }
                }}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryText}>Salvar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!move} transparent animationType="fade" onRequestClose={() => setMove(null)}>
        <Pressable style={styles.modalBg} onPress={() => setMove(null)}>
          <Pressable style={styles.modal} onPress={() => undefined}>
            <Text style={styles.modalTitle}>Movimentar saldo {move ? `· ${move.uid}` : ''}</Text>
            <View style={styles.chips}>
              {(
                [
                  ['topup', 'Recarga'],
                  ['consumption', 'Consumo'],
                  ['refund', 'Estorno'],
                  ['adjust', 'Ajuste'],
                ] as const
              ).map(([value, label]) => (
                <Pressable
                  key={value}
                  onPress={() => setMoveType(value)}
                  style={[styles.chip, moveType === value && styles.chipOn]}
                >
                  <Text style={[styles.chipText, moveType === value && styles.chipTextOn]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={moveAmount}
              onChangeText={setMoveAmount}
              placeholder="Valor (R$)"
              keyboardType="decimal-pad"
              placeholderTextColor="rgba(255,255,255,0.32)"
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setMove(null)} style={styles.ghostBtn}>
                <Text style={styles.ghostText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  const amount = Number(moveAmount.replace(',', '.'));
                  if (!move || !Number.isFinite(amount) || amount <= 0) return;
                  try {
                    await moveCashless({ cardId: move.id, type: moveType, amount });
                    onToast('Saldo atualizado');
                    setMove(null);
                    setMoveAmount('');
                    await load();
                  } catch (caught) {
                    const message = caught instanceof Error ? caught.message : '';
                    onToast(message.includes('saldo_insuficiente') ? 'Saldo insuficiente' : 'Não foi possível atualizar');
                  }
                }}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryText}>Confirmar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!history} transparent animationType="fade" onRequestClose={() => setHistory(null)}>
        <Pressable style={styles.modalBg} onPress={() => setHistory(null)}>
          <Pressable style={styles.modal} onPress={() => undefined}>
            <Text style={styles.modalTitle}>Histórico {history ? `· ${history.uid}` : ''}</Text>
            {txs.length === 0 ? <Text style={styles.empty}>Nenhuma movimentação registrada.</Text> : null}
            {txs.map((tx) => (
              <View key={tx.id} style={styles.line}>
                <Text style={styles.meta}>
                  {CASHLESS_TX_LABELS[tx.type] ?? tx.type} · {formatDateTime(tx.createdAt)}
                </Text>
                <Text style={styles.meta}>{formatBRL(tx.amount)}</Text>
              </View>
            ))}
            <Pressable onPress={() => setHistory(null)} style={[styles.ghostBtn, { marginTop: 12 }]}>
              <Text style={styles.ghostText}>Fechar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  boot: { minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  miniBoot: { minHeight: 140, alignItems: 'center', justifyContent: 'center' },
  block: { marginTop: 18, gap: 10 },
  gap: { gap: 8 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  group: { color: colors.text, fontSize: 13, fontWeight: '700' },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  empty: { color: colors.muted, fontSize: 13 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  amountRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  fieldLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  input: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: colors.text,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.blue,
    borderRadius: 12,
    minHeight: 40,
    paddingHorizontal: 12,
  },
  primaryText: { color: colors.loginText, fontWeight: '700', fontSize: 13 },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    minHeight: 40,
    paddingHorizontal: 12,
  },
  ghostText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  linkBtn: { paddingVertical: 4 },
  linkText: { color: colors.blue, fontWeight: '700', fontSize: 13 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tokenBox: {
    borderWidth: 1,
    borderColor: colors.blue,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(0,123,255,0.08)',
  },
  token: { color: colors.blue, fontSize: 22, fontWeight: '800', letterSpacing: 3 },
  tokenMini: { color: colors.blue, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  subTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  subTab: {
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subTabOn: { backgroundColor: colors.blue },
  subTabText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  subTabTextOn: { color: colors.loginText },
  hit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: 10,
  },
  hitInfo: { flex: 1, minWidth: 0 },
  deviceName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  badge: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
    color: colors.muted,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  badgeOn: { color: '#4ade80', backgroundColor: 'rgba(74,222,128,0.15)' },
  badgeOff: { color: colors.muted, backgroundColor: 'rgba(255,255,255,0.08)' },
  badgeDanger: { color: colors.danger, backgroundColor: 'rgba(255,92,122,0.15)' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  periodRow: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: 6 },
  periodChip: { flexShrink: 1 },
  chip: {
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.blue },
  chipText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  chipTextOn: { color: colors.loginText },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  dateText: { color: colors.text, fontSize: 13, flex: 1, fontWeight: '600' },
  dateOk: { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 4 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: 10,
  },
  kpiAccent: { borderColor: 'rgba(0,123,255,0.35)', backgroundColor: 'rgba(0,123,255,0.12)' },
  kpiLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  kpiValue: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 4 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 4 },
  off: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    backgroundColor: '#050d1f',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    padding: 16,
    gap: 10,
    maxHeight: '88%',
  },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  modalText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
