import type { Destination, Fine, PaletteName, Rule, SeverityOption } from './types';

export const SEVERITIES: SeverityOption[] = [
  { id: 'mild', name: 'Mild', mult: 1 },
  { id: 'bad', name: 'Bad', mult: 2 },
  { id: 'unforgivable', name: 'Unforgivable', mult: 3 },
];

export const SEVERITY_MULTIPLIER: Record<string, number> = {
  mild: 1,
  bad: 2,
  unforgivable: 3,
};

export const DEFAULT_RULES: Rule[] = [
  { id: 'swear', name: 'Swearing', price: 1 },
  { id: 'late', name: 'Late again', price: 2.5 },
  { id: 'phone', name: 'Phone at dinner', price: 2 },
];

export const DESTINATIONS: Destination[] = [
  { id: 'date', name: 'Date night', note: 'Somewhere neither of you has to cook' },
  { id: 'trip', name: 'Trip to Lisbon', note: '$248 of $1,200 saved' },
  { id: 'charity', name: 'Charity', note: 'Goes out the same day' },
  { id: 'wheel', name: 'Spin the wheel', note: 'Let the app decide' },
];

export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const PALETTE_NAMES: PaletteName[] = ['Mulberry', 'Pine', 'Ink', 'Terracotta'];

/**
 * Coin slots in the jar's 200x250 viewBox: [cx, cy, r], stacked bottom-up.
 * The array length is also the coin cap.
 */
export const COIN_SLOTS: ReadonlyArray<readonly [number, number, number]> = [
  [58, 228, 16], [92, 232, 15], [126, 227, 16], [154, 231, 14],
  [48, 202, 15], [80, 206, 16], [112, 201, 15], [144, 205, 16],
  [60, 176, 16], [94, 173, 15], [128, 178, 16], [156, 174, 13],
  [50, 150, 14], [84, 147, 15], [118, 151, 14], [148, 146, 12],
  [62, 124, 14], [96, 121, 13], [130, 125, 14],
];

export const COIN_CAP = COIN_SLOTS.length;

/** The floor a cash-out or an undo drops the jar back to. */
export const COIN_FLOOR = 3;

export const COIN_FILLS = [
  'var(--color-accent-400)',
  'var(--color-accent-2-400)',
  'var(--color-accent-300)',
  'var(--color-neutral-400)',
  'var(--color-accent-500)',
  'var(--color-accent-2-300)',
  'var(--color-accent-2-500)',
];

/** The jar body silhouette, shared by the hero SVG and the Jar tab glyph. */
export const JAR_BODY_PATH =
  'M30 64a42 42 0 0 1 42-42h56a42 42 0 0 1 42 42v142a42 42 0 0 1-42 42H72a42 42 0 0 1-42-42z';

/** How long Peek holds a masked figure open, in ms. */
export const PEEK_MS = 2200;

export const DEFAULT_ME = 'Alex';
export const DEFAULT_PARTNER = 'Sam';

/** Fallbacks when someone clears their name in Settings. */
export const NAME_FALLBACK_ME = 'You';
export const NAME_FALLBACK_PARTNER = 'Them';

export const JAR_STARTED = '4 March';

export const INVITE_CODE = 'JAR-4K2P';
export const INVITE_URL = 'sorryjar.app/j/4k2p';

/**
 * The 17 demo fines from the handoff: $48.50 total, Alex $31.00, Sam $17.50.
 * Kept as fixtures until real persistence and pairing land.
 */
export const SEED_FINES: Fine[] = [
  { id: 'seed-1', who: 'A', by: 'S', rule: 'swear', label: 'Swearing', sev: 'unforgivable', amt: 3, when: '2 hours ago', day: 5 },
  { id: 'seed-2', who: 'S', by: 'S', rule: 'phone', label: 'Phone at dinner', sev: 'mild', amt: 2, when: 'Yesterday', day: 4 },
  { id: 'seed-3', who: 'A', by: 'S', rule: 'late', label: 'Late again', sev: 'bad', amt: 5, when: 'Yesterday', day: 4 },
  { id: 'seed-4', who: 'A', by: 'S', rule: 'swear', label: 'Swearing', sev: 'bad', amt: 2, when: 'Yesterday', day: 4 },
  { id: 'seed-5', who: 'A', by: 'S', rule: 'phone', label: 'Phone at dinner', sev: 'mild', amt: 2, when: 'Tuesday', day: 2 },
  { id: 'seed-6', who: 'S', by: 'S', rule: 'swear', label: 'Swearing', sev: 'mild', amt: 1, when: 'Tuesday', day: 2 },
  { id: 'seed-7', who: 'A', by: 'S', rule: 'late', label: 'Late again', sev: 'mild', amt: 2.5, when: 'Tuesday', day: 2 },
  { id: 'seed-8', who: 'A', by: 'S', rule: 'swear', label: 'Swearing', sev: 'bad', amt: 2, when: 'Monday', day: 1 },
  { id: 'seed-9', who: 'S', by: 'S', rule: 'late', label: 'Late again', sev: 'mild', amt: 2.5, when: 'Monday', day: 1 },
  { id: 'seed-10', who: 'A', by: 'S', rule: 'late', label: 'Late again', sev: 'unforgivable', amt: 7.5, when: 'Sunday', day: 0 },
  { id: 'seed-11', who: 'S', by: 'S', rule: 'phone', label: 'Phone at dinner', sev: 'bad', amt: 4, when: 'Sunday', day: 0 },
  { id: 'seed-12', who: 'A', by: 'S', rule: 'swear', label: 'Swearing', sev: 'mild', amt: 1, when: 'Saturday', day: 6 },
  { id: 'seed-13', who: 'S', by: 'S', rule: 'swear', label: 'Swearing', sev: 'bad', amt: 2, when: 'Saturday', day: 6 },
  { id: 'seed-14', who: 'A', by: 'S', rule: 'phone', label: 'Phone at dinner', sev: 'bad', amt: 4, when: 'Friday', day: 5 },
  { id: 'seed-15', who: 'S', by: 'S', rule: 'late', label: 'Late again', sev: 'bad', amt: 5, when: 'Thursday', day: 4 },
  { id: 'seed-16', who: 'A', by: 'S', rule: 'swear', label: 'Swearing', sev: 'bad', amt: 2, when: 'Thursday', day: 4 },
  { id: 'seed-17', who: 'S', by: 'S', rule: 'swear', label: 'Swearing', sev: 'mild', amt: 1, when: 'Wednesday', day: 3 },
];

export const SEED_TOTAL_EVER = 112;
export const SEED_COINS = 15;
export const SEED_NEXT_ID = 100;
