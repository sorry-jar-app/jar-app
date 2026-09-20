import { test } from 'node:test';
import assert from 'node:assert/strict';
import { masked, money, parseAmount, veil } from './money.ts';

test('money always shows two decimals', () => {
  assert.equal(money(0), '$0.00');
  assert.equal(money(5), '$5.00');
  assert.equal(money(2.5), '$2.50');
  assert.equal(money(48.5), '$48.50');
});

test('masked keeps the shape and gives up the digits', () => {
  assert.equal(masked(48.5), '$••.••');
  assert.equal(masked(7), '$•.••');
  // Longer figures must not leak their magnitude through a fixed-width mask.
  assert.equal(masked(1234.5), '$••••.••');
});

test('masked leaves no digit anywhere', () => {
  for (const n of [0, 0.01, 9.99, 50, 100, 1234.56, 99999.99]) {
    assert.match(masked(n), /^\$[•.]+$/, `leaked a digit for ${n}`);
  }
});

test('veil is the sealed-aware one', () => {
  assert.equal(veil(48.5, false), '$48.50');
  assert.equal(veil(48.5, true), '$••.••');
});

test('parseAmount strips everything that is not a number', () => {
  assert.equal(parseAmount('5'), 5);
  assert.equal(parseAmount('$5'), 5);
  assert.equal(parseAmount('  12.34  '), 12.34);
  assert.equal(parseAmount('1,234.50'), 1234.5);
  assert.equal(parseAmount('abc'), 0);
  assert.equal(parseAmount(''), 0);
});

test('parseAmount rounds to two decimals so money never carries float dust', () => {
  assert.equal(parseAmount('1.005'), 1.01);
  assert.equal(parseAmount('0.1'), 0.1);
  assert.equal(parseAmount('2.999'), 3);
});

test('a zero or unparseable amount blocks submission by returning falsy', () => {
  // The screens gate on `parseAmount(x) > 0`, so this contract matters.
  assert.ok(!parseAmount('0'));
  assert.ok(!parseAmount('$0.00'));
  assert.ok(!parseAmount('nope'));
  assert.ok(parseAmount('0.01'));
});
