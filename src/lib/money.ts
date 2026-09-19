/**
 * Money helpers.
 *
 * Every figure in the app goes through one of these. `veil` is the one that
 * matters: Mystery jar is only as good as its weakest surface, so any new
 * screen that shows money must decide explicitly whether it seals.
 */

/** `$48.50`. */
export function money(n: number): string {
  return '$' + n.toFixed(2);
}

/**
 * `$••.••` — each digit replaced, the currency symbol and decimal shape kept
 * so the figure still reads as money without giving up the number.
 */
export function masked(n: number): string {
  return '$' + n.toFixed(2).replace(/[0-9]/g, '•');
}

/**
 * The sealed-aware formatter. `sealed` is true when Mystery jar is on and the
 * user is not mid-Peek.
 */
export function veil(n: number, sealed: boolean): string {
  return sealed ? masked(n) : money(n);
}

/**
 * Parse a money input: strip everything but digits and a dot, round to two
 * decimals. Returns 0 for anything unparseable, which blocks submission.
 */
export function parseAmount(value: string | number): number {
  const n = parseFloat(String(value).replace(/[^0-9.]/g, '')) || 0;
  return Math.round(n * 100) / 100;
}
