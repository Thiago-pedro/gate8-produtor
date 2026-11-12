import assert from 'node:assert/strict';
import test from 'node:test';

import {
  availableLiquid,
  buildFinanceSalesCount,
  computeBatchSoldCards,
  computePackageStats,
} from './finance-calc.ts';

test('pacotes históricos sem cortesia marcada + lote extra', () => {
  const batches = [
    { id: 'pkg', tickets_per_purchase: 6, complimentary_per_purchase: 1 },
    { id: 'extra', tickets_per_purchase: 1, complimentary_per_purchase: 0 },
  ];
  const tickets = [
    ...Array.from({ length: 12 }, (_, i) => ({
      id: `p${i}`,
      status: 'issued',
      payment_method: 'pix',
      batch_id: 'pkg',
      purchase: { user_id: 'u1' },
    })),
    ...Array.from({ length: 3 }, (_, i) => ({
      id: `e${i}`,
      status: 'issued',
      payment_method: 'pix',
      batch_id: 'extra',
      purchase: { user_id: 'u2' },
    })),
    {
      id: 'free',
      status: 'issued',
      payment_method: null,
      batch_id: 'extra',
      purchase: { user_id: 'u3' },
    },
  ];

  const stats = computePackageStats(tickets, batches);
  assert.equal(stats.packagesSold, 2);
  assert.equal(stats.packageTickets, 12);
  assert.equal(stats.extraTickets, 4);
  assert.equal(stats.total, 16);
  // 2 cortesias do pacote (sem payment_method nulo) + 1 cortesia extra armazenada
  assert.equal(stats.courtesyTickets, 3);
  assert.equal(stats.clients, 3);
});

test('mesmo cliente com pacote e compras adicionais conta um cliente', () => {
  const batches = [{ id: 'pkg', tickets_per_purchase: 6, complimentary_per_purchase: 1 }];
  const tickets = [
    ...Array.from({ length: 6 }, (_, i) => ({
      id: `a${i}`,
      status: 'issued',
      payment_method: 'pix',
      batch_id: 'pkg',
      purchase: { user_id: 'same' },
    })),
    {
      id: 'extra-buy',
      status: 'issued',
      payment_method: 'credit_card',
      batch_id: 'pkg',
      purchase: { user_id: 'same' },
    },
  ];
  const stats = computePackageStats(tickets, batches);
  assert.equal(stats.clients, 1);
  assert.equal(stats.packagesSold, 2);
  assert.equal(stats.courtesyTickets, Math.min(7, Math.ceil(7 / 6) * 1));
});

test('cards por lote: ignora cortesia e cancelado; ordena por sort_order', () => {
  const batches = [
    { id: 'b2', name: 'Pista', sort_order: 2 },
    { id: 'b1', name: 'VIP', sort_order: 1 },
  ];
  const tickets = [
    { batch_id: 'b1', status: 'issued', payment_method: 'pix' },
    { batch_id: 'b1', status: 'issued', payment_method: 'pix' },
    { batch_id: 'b1', status: 'issued', payment_method: null },
    { batch_id: 'b1', status: 'cancelled', payment_method: 'pix' },
    { batch_id: 'b2', status: 'issued', payment_method: 'credit_card' },
  ];
  const cards = computeBatchSoldCards(tickets, batches);
  assert.deepEqual(cards, [
    { id: 'b1', name: 'VIP', sold: 2 },
    { id: 'b2', name: 'Pista', sold: 1 },
  ]);
});

test('boleto de duas parcelas: parcial não conta; quitado conta uma vez', () => {
  const rows = [
    { method: 'pix', isPos: false },
    { method: 'boleto', boletoIssuedCount: 2, boletoPaidCount: 1 },
    { method: 'boleto', boletoIssuedCount: 2, boletoPaidCount: 2 },
    { method: 'boleto', boletoIssuedCount: 1, boletoPaidCount: 0 },
    { isCourtesy: true, method: null },
    { isCancelled: true, method: 'pix' },
    { isPos: true, method: 'credit_card' },
  ];
  assert.equal(buildFinanceSalesCount(rows), 3);
});

test('boleto materializado não duplica venda nas linhas de ingresso', () => {
  // Após materializar, a venda já está na linha de boleto; ingressos boleto/materializados
  // são excluídos na agregação — aqui só validamos a contagem das linhas finais.
  assert.equal(
    buildFinanceSalesCount([
      { method: 'boleto', boletoIssuedCount: 1, boletoPaidCount: 1 },
      { method: 'pix' },
    ]),
    2
  );
});

test('retirada paga, pendente e rejeitada no disponível', () => {
  const eventNet = 49047.34;
  const withdrawnPaid = 29112;
  const withdrawnPending = 0;
  const withdrawnRejected = 5000; // ignorada
  void withdrawnRejected;
  const withdrawnTotal = withdrawnPaid + withdrawnPending;
  assert.equal(availableLiquid(eventNet, withdrawnTotal), 19935.34);
  assert.equal(availableLiquid(100, 40 + 25), 35);
  assert.equal(availableLiquid(10, 50), 0);
});

test('print Colação: relações de pacote 5+1', () => {
  const batches = [
    { id: 'pkg', tickets_per_purchase: 6, complimentary_per_purchase: 1 },
    { id: 'extra', tickets_per_purchase: 1, complimentary_per_purchase: 0 },
  ];
  const tickets = [
    ...Array.from({ length: 930 }, (_, i) => ({
      id: `p${i}`,
      status: 'issued',
      payment_method: 'pix',
      batch_id: 'pkg',
      purchase: { user_id: `u${i % 154}` },
    })),
    ...Array.from({ length: 100 }, (_, i) => ({
      id: `e${i}`,
      status: 'issued',
      payment_method: 'pix',
      batch_id: 'extra',
      purchase: { user_id: `u${i % 154}` },
    })),
  ];
  const stats = computePackageStats(tickets, batches);
  assert.equal(stats.packagesSold, 155);
  assert.equal(stats.packageTickets, 930);
  assert.equal(stats.extraTickets, 100);
  assert.equal(stats.total, 1030);
  assert.equal(stats.courtesyTickets, 155);
  assert.equal(stats.total - stats.courtesyTickets, 875);
  assert.equal(stats.clients, 154);
});
