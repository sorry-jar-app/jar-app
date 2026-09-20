import { test } from 'node:test';
import assert from 'node:assert/strict';
import { finesToRows, toCsv, type ExportEntry } from './csv.ts';
import type { Fine } from './types.ts';

function fine(over: Partial<Fine> = {}): Fine {
  return {
    id: 'f1',
    who: 'A',
    by: 'S',
    rule: 'swear',
    label: 'Swearing',
    sev: 'bad',
    amt: 2,
    when: '2026-09-19T10:00:00.000Z',
    day: 5,
    ...over,
  };
}

const entry = (f: Fine, cashedOutAt: string | null = null, destination: string | null = null):
  ExportEntry => ({ fine: f, cashedOutAt, destination });

test('a plain field is not quoted', () => {
  assert.equal(toCsv([['a', 'b']]), 'a,b');
});

test('a comma forces quoting', () => {
  assert.equal(toCsv([['Late, again']]), '"Late, again"');
});

test('a double quote is doubled and the field quoted', () => {
  assert.equal(toCsv([['He said "no"']]), '"He said ""no"""');
});

test('a newline inside a field is quoted, not emitted raw', () => {
  const out = toCsv([['line one\nline two']]);
  assert.equal(out, '"line one\nline two"');
  // The row separator must remain distinguishable from the embedded break.
  assert.equal(out.split('\r\n').length, 1);
});

test('edge whitespace is preserved by quoting', () => {
  assert.equal(toCsv([[' padded ']]), '" padded "');
});

test('rows are separated by CRLF', () => {
  assert.equal(toCsv([['a'], ['b']]), 'a\r\nb');
});

test('a rule name full of punctuation still round-trips as one field', () => {
  const nasty = 'Swearing, "loudly"\nat dinner';
  const csv = toCsv([[nasty, '1.00']]);
  assert.ok(csv.startsWith('"'), 'should be quoted');
  // Exactly one unquoted comma, the delimiter before the amount.
  assert.equal(csv.slice(csv.lastIndexOf('"') + 1), ',1.00');
});

test('the header row leads and names every column', () => {
  const rows = finesToRows([], { me: 'Nick', partner: 'Jordan' });
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0][0], 'Date');
  assert.equal(rows[0].length, 8);
});

test('A and S resolve to the real names, and `by` is not confused with `who`', () => {
  const rows = finesToRows([entry(fine({ who: 'A', by: 'S' }))], { me: 'Nick', partner: 'Jordan' });
  assert.equal(rows[1][1], 'Nick', 'who it was on');
  assert.equal(rows[1][2], 'Jordan', 'who logged it');
});

test('the amount is a bare two-decimal number a spreadsheet can total', () => {
  const rows = finesToRows([entry(fine({ amt: 7.5 }))], { me: 'a', partner: 'b' });
  assert.equal(rows[1][5], '7.50');
  assert.doesNotMatch(rows[1][5], /[$,]/);
});

test('a one-off is still distinguishable from a rule-based fine', () => {
  const rows = finesToRows([entry(fine({ sev: 'one-off' }))], { me: 'a', partner: 'b' });
  assert.equal(rows[1][4], 'One-off');
});

test('severities read as their display names', () => {
  const rows = finesToRows(
    [entry(fine({ sev: 'mild' })), entry(fine({ sev: 'unforgivable' }))],
    { me: 'a', partner: 'b' },
  );
  assert.equal(rows[1][4], 'Mild');
  assert.equal(rows[2][4], 'Unforgivable');
});

test('a seeded display string is written through, not invented into a date', () => {
  const rows = finesToRows([entry(fine({ when: 'Yesterday' }))], { me: 'a', partner: 'b' });
  assert.equal(rows[1][0], 'Yesterday');
});

test('an uncashed fine leaves the cash-out columns empty, a swept one fills them', () => {
  const rows = finesToRows(
    [entry(fine()), entry(fine({ id: 'f2' }), '2026-09-18T09:00:00.000Z', 'Date night')],
    { me: 'a', partner: 'b' },
  );
  assert.equal(rows[1][6], '');
  assert.equal(rows[1][7], '');
  assert.match(rows[2][6], /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  assert.equal(rows[2][7], 'Date night');
});

test('every row has as many columns as the header', () => {
  const rows = finesToRows(
    [entry(fine()), entry(fine({ id: 'f2', sev: 'one-off' }), '2026-01-01T00:00:00.000Z', 'Charity')],
    { me: 'a', partner: 'b' },
  );
  for (const row of rows) assert.equal(row.length, rows[0].length);
});

test('a cell that would execute in a spreadsheet is defused', () => {
  // Not a hypothetical: rule names are free text from both partners.
  for (const nasty of ['=1+1', '+SUM(A1)', '-5 minutes late', '@import', '\tlead']) {
    const cell = toCsv([[nasty]]);
    assert.ok(!/^[=+\-@\t]/.test(cell.replace(/^"/, '')), `left executable: ${cell}`);
  }
});

test('an ordinary label is not mangled by the injection guard', () => {
  assert.equal(toCsv([['Late again']]), 'Late again');
  assert.equal(toCsv([['Phone at dinner']]), 'Phone at dinner');
});

test('a real timestamp becomes a date a spreadsheet can parse', () => {
  const rows = finesToRows([entry(fine({ when: '2026-09-19T21:04:11.123Z' }))], { me: 'a', partner: 'b' });
  assert.match(rows[1][0], /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  assert.doesNotMatch(rows[1][0], /T|Z/);
});

test('a seeded display string is still written through as-is', () => {
  const rows = finesToRows([entry(fine({ when: 'Tuesday' }))], { me: 'a', partner: 'b' });
  assert.equal(rows[1][0], 'Tuesday');
});

test('one-off reads like the other severities, not like a raw enum', () => {
  const rows = finesToRows([entry(fine({ sev: 'one-off' }))], { me: 'a', partner: 'b' });
  assert.equal(rows[1][4], 'One-off');
});
