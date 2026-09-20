/**
 * The Settings row has promised a CSV since the first build.
 *
 * Two rules drive everything here. A spreadsheet must read the amount column
 * as a number, so it carries no currency symbol. And the export is the whole
 * history — fines the jar has already cashed out included — which is why a
 * cash-out stamps its fines rather than deleting them.
 */

import { SEVERITIES } from './constants';
import { isTimestamp } from './when';
import type { Fine } from './types';

/** A fine plus the cash-out that swept it, if one has. */
export type ExportEntry = {
  fine: Fine;
  cashedOutAt: string | null;
  destination: string | null;
};

export const CSV_COLUMNS = [
  'Date',
  'Who it was on',
  'Who logged it',
  'What',
  'Severity',
  'Amount',
  'Cashed out',
  'Went to',
] as const;

/**
 * RFC 4180 quoting, plus a guard against spreadsheet formula injection.
 *
 * A cell beginning with = + - @ tab or CR is evaluated on open by Excel and
 * Sheets. No malice needed: a rule called "-5 minutes late" opens as #NAME?.
 * A leading apostrophe is the conventional defusal and does not show in the
 * cell.
 */
function field(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (!/[",\r\n]/.test(safe) && safe === safe.trim()) return safe;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Rows to a CSV document. CRLF is what the spec says and what Excel wants. */
export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(field).join(',')).join('\r\n');
}

function severityLabel(sev: Fine['sev']): string {
  if (sev === 'one-off') return 'One-off';
  return SEVERITIES.find((s) => s.id === sev)?.name ?? sev;
}

/**
 * A spreadsheet-readable date.
 *
 * Real fines carry an ISO instant, which no spreadsheet parses in its `T`
 * form, so it becomes `YYYY-MM-DD HH:MM` in local time. The demo's fixtures
 * carry display strings ("Yesterday") and pass through untouched — inventing a
 * date for a fixture would be inventing history.
 */
export function spreadsheetDate(when: string): string {
  if (!isTimestamp(when)) return when;
  const d = new Date(when);
  if (Number.isNaN(d.getTime())) return when;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/**
 * The sheet, header row included.
 *
 * `when` is written through untouched: real fines carry an ISO timestamp and
 * the demo's fixtures carry a display string ("Yesterday"), and inventing a
 * date for a fixture would be inventing history.
 */
export function finesToRows(
  entries: readonly ExportEntry[],
  names: { me: string; partner: string },
): string[][] {
  const nameOf = (p: Fine['who']) => (p === 'A' ? names.me : names.partner);

  return [
    [...CSV_COLUMNS],
    ...entries.map(({ fine, cashedOutAt, destination }) => [
      spreadsheetDate(fine.when),
      nameOf(fine.who),
      nameOf(fine.by),
      fine.label,
      severityLabel(fine.sev),
      fine.amt.toFixed(2),
      cashedOutAt ? spreadsheetDate(cashedOutAt) : '',
      destination ?? '',
    ]),
  ];
}

/** Hand the file to the browser. The BOM is what stops Excel mangling a name. */
export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(
    new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }),
  );

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Safari cancels a download whose object URL is revoked in the same tick,
  // and Safari is the whole target platform here.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
