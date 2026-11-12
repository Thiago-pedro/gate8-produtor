import assert from 'node:assert/strict';
import test from 'node:test';

import {
  eventEffectiveEnd,
  formatEventEndShort,
  formatEventPeriod,
  formatEventPeriodParts,
  validateEventPeriod,
} from './event-period.ts';

/** Novembro/2026 em São Paulo = UTC−3 (sem horário de verão). */
const START_18 = '2026-11-14T21:00:00.000Z'; // 14/11 18h00 BRT
const END_SAME_2230 = '2026-11-15T01:30:00.000Z'; // 14/11 22h30 BRT
const START_22 = '2026-11-15T01:00:00.000Z'; // 14/11 22h00 BRT
const END_NEXT_06 = '2026-11-15T09:00:00.000Z'; // 15/11 06h00 BRT

test('sem término: só o início', () => {
  assert.equal(formatEventPeriod(START_18, null), '14/11/2026 às 18h00');
  assert.equal(formatEventPeriod(START_18), '14/11/2026 às 18h00');
});

test('mesmo dia: até só a hora final', () => {
  assert.equal(formatEventPeriod(START_18, END_SAME_2230), '14/11/2026 às 18h00 até 22h30');
  assert.deepEqual(formatEventPeriodParts(START_18, END_SAME_2230), {
    line1: '14/11/2026 às 18h00',
    mid: 'até',
    line2: '22h30',
  });
});

test('outro dia: data e hora finais', () => {
  assert.equal(
    formatEventPeriod(START_22, END_NEXT_06),
    '14/11/2026 às 22h00 até 15/11/2026 às 06h00'
  );
  assert.deepEqual(formatEventPeriodParts(START_22, END_NEXT_06), {
    line1: '14/11/2026 às 22h00',
    mid: 'até',
    line2: '15/11/2026 às 06h00',
  });
});

test('só início: uma linha, sem mid/line2', () => {
  assert.deepEqual(formatEventPeriodParts(START_18, null), {
    line1: '14/11/2026 às 18h00',
    mid: null,
    line2: null,
  });
});

test('texto curto do término', () => {
  assert.equal(formatEventEndShort(START_22, END_NEXT_06), 'até 15/11 às 06h00');
  assert.equal(formatEventEndShort(START_18, null), '');
});

test('sem data → Data e hora em breve', () => {
  assert.equal(formatEventPeriod(null), 'Data e hora em breve');
  assert.equal(formatEventPeriod(''), 'Data e hora em breve');
  assert.equal(formatEventPeriod('nao-e-data'), 'Data e hora em breve');
});

test('término inválido cai no texto só do início', () => {
  assert.equal(formatEventPeriod(START_18, 'lixo'), '14/11/2026 às 18h00');
});

test('validateEventPeriod mensagens oficiais', () => {
  assert.equal(
    validateEventPeriod(null, new Date(END_SAME_2230)),
    'Informe a data e hora de início antes do término.'
  );
  assert.equal(
    validateEventPeriod(new Date(START_18), new Date(START_18)),
    'O término precisa ser depois do início.'
  );
  assert.equal(
    validateEventPeriod(new Date(END_SAME_2230), new Date(START_18)),
    'O término precisa ser depois do início.'
  );
  assert.equal(validateEventPeriod(new Date('invalid'), null), 'Data e hora inválidas.');
  assert.equal(validateEventPeriod(new Date(START_18), new Date(END_SAME_2230)), null);
  assert.equal(validateEventPeriod(new Date(START_18), null), null);
});

test('eventEffectiveEnd usa término ou início', () => {
  assert.equal(eventEffectiveEnd(START_18, END_NEXT_06), END_NEXT_06);
  assert.equal(eventEffectiveEnd(START_18, null), START_18);
  assert.equal(eventEffectiveEnd(null, null), null);
});
