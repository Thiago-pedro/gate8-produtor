import assert from 'node:assert/strict';
import test from 'node:test';

import { brazilDayKey, brazilDayLabel, buildSalesPulse, lastNDayKeys } from './sales-pulse.ts';

test('rótulo de dia no formato do site', () => {
  assert.equal(brazilDayLabel('2026-11-06'), '6 nov');
  assert.equal(brazilDayLabel('2026-11-12'), '12 nov');
});

test('últimos 7 dias incluem hoje e vão do antigo ao recente', () => {
  const now = new Date('2026-11-12T18:00:00.000Z');
  const keys = lastNDayKeys(7, now);
  assert.equal(keys.length, 7);
  assert.equal(keys[keys.length - 1], brazilDayKey(now));
  assert.equal(keys[0], brazilDayKey(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)));
});

test('pulse: pagos, cortesia, validados e janela de 7 dias', () => {
  const now = new Date('2026-11-12T18:00:00.000Z');
  const pulse = buildSalesPulse(
    [
      { created_at: '2026-11-12T10:00:00.000Z', payment_method: 'pix', status: 'issued' },
      { created_at: '2026-11-12T12:00:00.000Z', payment_method: 'pix', status: 'used' },
      { created_at: '2026-11-10T15:00:00.000Z', payment_method: 'credit_card', status: 'issued' },
      { created_at: '2026-11-12T11:00:00.000Z', payment_method: null, status: 'issued' },
      { created_at: '2026-11-12T11:00:00.000Z', payment_method: 'pix', status: 'cancelled' },
      { created_at: '2026-10-01T15:00:00.000Z', payment_method: 'pix', status: 'issued' },
    ],
    now
  );
  assert.equal(pulse.soldPaid, 4);
  assert.equal(pulse.courtesy, 1);
  assert.equal(pulse.validated, 1);
  assert.equal(pulse.soldToday, 2);
  assert.equal(pulse.soldLast7, 3);
  assert.equal(pulse.daily.length, 7);
  assert.equal(pulse.daily[pulse.daily.length - 1]?.count, 2);
});
