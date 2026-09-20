/** A = "me" (this device's user), S = the partner. */
export type Person = 'A' | 'S';

export type Severity = 'mild' | 'bad' | 'unforgivable' | 'one-off';

export type Rule = {
  id: string;
  name: string;
  /** Base price in currency units, before the severity multiplier. */
  price: number;
};

export type Fine = {
  id: string;
  /** Who the fine is on. */
  who: Person;
  /** Who logged it. Drives the notification copy, not the ledger. */
  by: Person;
  /** Rule id, or 'custom' for a one-off. */
  rule: string;
  /**
   * The rule's name as it read when the fine was logged, denormalised on
   * purpose: renaming or deleting a rule must not rewrite history, and a
   * one-off has no rule to point at. Do not resolve this through `rule`.
   */
  label: string;
  sev: Severity;
  /** Base price x multiplier, or the exact one-off amount. */
  amt: number;
  /** Display string in the seed data; real fines carry an ISO timestamp. */
  when: string;
  /** 0-6, Sunday first — for the day-of-week chart. */
  day: number;
};

export type Destination = {
  id: string;
  name: string;
  note: string;
};

export type SeverityOption = {
  id: Exclude<Severity, 'one-off'>;
  name: string;
  mult: number;
};

export type PaletteName = 'Mulberry' | 'Pine' | 'Ink' | 'Terracotta';

export type NotificationPrefs = {
  /** Partner fined you. */
  fined: boolean;
  /** Partner fined themselves. */
  selfFined: boolean;
  /** The jar crossed a round number. */
  milestone: boolean;
};
