/**
 * Turning a fine's timestamp into the words History shows.
 *
 * The prototype's seed data carries display strings — "2 hours ago",
 * "Yesterday", "Tuesday" — and History grouped on that string directly. Real
 * fines carry an ISO timestamp, which is unique per fine, so grouping on it
 * raw would put every fine in a group of its own. These helpers collapse a
 * timestamp to the label the handoff asks for ("Today" / "Yesterday" /
 * weekday / date) and pass legacy display strings through untouched, so seeded
 * and real fines can sit in the same list.
 */

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** An ISO-8601 timestamp, as opposed to one of the seed's display strings. */
export function isTimestamp(when: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(when);
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** The day-group heading: "Today", "Yesterday", a weekday, or "4 March". */
export function groupLabel(when: string, now: Date = new Date()): string {
  if (!isTimestamp(when)) return when;

  const then = new Date(when);
  if (Number.isNaN(then.getTime())) return when;

  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  // Inside the last week a weekday still reads as "recent"; past that it
  // stops being useful and a date is clearer.
  if (days < 7) return WEEKDAYS[then.getDay()];
  return `${then.getDate()} ${MONTHS[then.getMonth()]}`;
}

/** The smaller line on a fine row: "Just now", "2 hours ago", or a date. */
export function rowLabel(when: string, now: Date = new Date()): string {
  if (!isTimestamp(when)) return when;

  const then = new Date(when);
  if (Number.isNaN(then.getTime())) return when;

  const mins = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);
  if (days === 1) return 'Yesterday';
  if (days < 7) return WEEKDAYS[then.getDay()];
  return `${then.getDate()} ${MONTHS[then.getMonth()]}`;
}

/**
 * "2026-03-04" → "4 March", the shape the design uses for the jar's start.
 *
 * Read off the string rather than through Date: a bare date parses as UTC
 * midnight, which is the day before anywhere west of Greenwich.
 */
export function formatStarted(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`;
}
