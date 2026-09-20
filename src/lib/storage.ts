/**
 * The persistence seam.
 *
 * Today: localStorage, which the Capacitor WebView also honours. When a real
 * backend lands, this is the file that changes — swap the body for a Capacitor
 * Preferences call or a fetch against the sync API and nothing above it moves.
 *
 * Every accessor is defensive: private mode, cleared site data and the
 * server-render pass all have to come back clean rather than throw.
 */

const KEY = 'sorry-jar:v1';

export function loadState<T>(): Partial<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as Partial<T>;
  } catch {
    return null;
  }
}

export function saveState<T>(state: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* Quota or a blocked store — the session still works, it just won't survive a reload. */
  }
}
