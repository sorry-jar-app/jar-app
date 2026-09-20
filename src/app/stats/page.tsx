'use client';

import { Label, Meter } from '@heroui/react';
import type { CSSProperties } from 'react';
import { DAYS } from '@/lib/constants';
import { veil } from '@/lib/money';
import { sumFines, useStore } from '@/lib/store';
import { isTimestamp, WEEKDAYS } from '@/lib/when';
import type { Fine } from '@/lib/types';

/*
 * The rule bar.
 *
 * A Meter is what this row has always been: a quantity in a known range, with
 * its name on the left and its figure on the right. HeroUI lays those three
 * parts out on the same grid the row already used — label, output, track
 * underneath — so the markup gets shorter and the bar gains a role, a name
 * and a value it did not have.
 *
 * The value is the PERCENTAGE, not the money. aria-valuenow is readable
 * whatever the screen says, and Mystery jar would leak straight through it;
 * the proportion is what the bar shows anyway, sealed or not. The figure
 * rides on valueLabel, which is what both the output and aria-valuetext
 * read, so the seal holds in the accessibility tree as well as on screen.
 *
 * .meter__track is h-2 on bg-default, which the bridge points at
 * --color-neutral-200: the same 8px and the same grey as .sj-bar-track. Only
 * the corners differ, and rounded-sm sits behind a two-class selector that
 * app.css cannot outrank, so the radius is inline.
 *
 * THE CONTRAST RULE: --meter-fill defaults to --accent, which the bridge pins
 * to the 600 step because text sits on it. A chart bar carries no text, so it
 * takes the 500 step, as the coins and the toggle tracks do.
 */
const RULE_BAR = {
  gap: 5,
  marginBottom: 11,
  '--meter-fill': 'var(--color-accent-500)',
} as CSSProperties;

/* .meter's own label and output are text-sm/medium; the panel's are 13/regular. */
const RULE_TEXT: CSSProperties = { fontSize: 13, fontWeight: 400 };

/**
 * Stats — four panels over the same fines everyone else reads.
 *
 * Two of the figures seal: the per-person totals reconstruct the jar total,
 * and so does the "most expensive rule" column added up. "Total ever" is
 * deliberately left in the clear — it is last jar's money, not this one's.
 *
 * Every ratio here divides by a max that is floored at 1, so an emptied jar
 * renders flat bars instead of NaN.
 */
/**
 * The longest stretch of consecutive days with no fine, in days.
 *
 * Returns null when there is nothing to measure — the seeded fixtures carry
 * display strings like "Tuesday" rather than dates, so there is no interval to
 * take. Better a dash than an invented nine.
 */
function longestCleanRun(fines: Fine[]): number | null {
  const days = new Set<number>();
  for (const f of fines) {
    if (!isTimestamp(f.when)) continue;
    const d = new Date(f.when);
    if (Number.isNaN(d.getTime())) continue;
    days.add(Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000));
  }
  if (days.size < 2) return null;

  const sorted = Array.from(days).sort((a, b) => a - b);
  let best = 0;
  for (let i = 1; i < sorted.length; i++) {
    best = Math.max(best, sorted[i] - sorted[i - 1] - 1);
  }
  return best;
}

export default function StatsPage() {
  const { state, sealed } = useStore();

  const meTotal = sumFines(state.fines, 'A');
  const partnerTotal = sumFines(state.fines, 'S');
  const peakPerson = Math.max(meTotal, partnerTotal, 1);

  const owed = [
    { key: 'A', total: meTotal, name: state.me, fill: 'var(--color-accent-500)' },
    { key: 'S', total: partnerTotal, name: state.partner, fill: 'var(--color-accent-2-500)' },
  ];

  // Grouped by the fine's own label, not its rule id, so a one-off shows up
  // under the name it was logged with and a renamed rule keeps its history.
  const byLabel = new Map<string, number>();
  for (const fine of state.fines) {
    byLabel.set(fine.label, (byLabel.get(fine.label) ?? 0) + fine.amt);
  }
  const ruleTotals = Array.from(byLabel, ([name, amt]) => ({ name, amt }))
    .sort((a, b) => b.amt - a.amt)
    .slice(0, 4);
  const maxRule = Math.max(1, ruleTotals.length ? ruleTotals[0].amt : 1);

  // fine.day is 0-6, Sunday first, matching DAYS.
  const byDay = DAYS.map((_day, i) =>
    state.fines.reduce((a, f) => (f.day === i ? a + f.amt : a), 0),
  );
  const maxDay = Math.max(1, ...byDay);

  // The caption used to say "Tuesdays" while the chart highlighted Thursday.
  // Read it off the same numbers the bars are drawn from.
  // WEEKDAYS, not DAYS: the latter is the three-letter axis label, and
  // "Thu" + "days" reads "Thudays".
  const heaviest = byDay.some((v) => v > 0)
    ? WEEKDAYS[byDay.indexOf(Math.max(...byDay))]
    : null;

  // The longest run of consecutive days with no fine at all — the thing the
  // panel has always claimed to show. Only meaningful once fines carry real
  // timestamps; the seeded display strings have no date to difference.
  const streak = longestCleanRun(state.fines);

  return (
    <div className="sj-screen sj-screen--tabbed">
      <div style={{ padding: '12px 24px 6px' }}>
        <h3 style={{ margin: 0 }}>Stats</h3>
      </div>

      <div className="sj-body" style={{ padding: '8px 24px 20px', gap: 12 }}>
        <section className="sj-panel">
          <h6 className="sj-label" style={{ margin: '0 0 12px' }}>
            Who owes more
          </h6>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, height: 104 }}>
            {owed.map((person) => (
              <div
                key={person.key}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 7,
                  justifyContent: 'flex-end',
                  height: '100%',
                }}
              >
                <span className="sj-money" style={{ fontSize: 18 }}>
                  {veil(person.total, sealed)}
                </span>
                <div
                  style={{
                    width: '100%',
                    borderRadius: '18px 18px 8px 8px',
                    background: person.fill,
                    height: Math.round(20 + (person.total / peakPerson) * 56),
                  }}
                />
                <span style={{ fontSize: 12 }}>{person.name}</span>
              </div>
            ))}
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <section className="sj-panel sj-panel--sage">
            <h6 style={{ margin: '0 0 6px' }}>Longest streak</h6>
            <div className="sj-money" style={{ fontSize: 26, lineHeight: 1.1 }}>
              {streak === null ? '—' : `${streak} day${streak === 1 ? '' : 's'}`}
            </div>
            <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
              {streak === null ? 'Once there is more history' : 'Nobody owing a thing'}
            </div>
          </section>

          <section className="sj-panel sj-panel--sage">
            <h6 style={{ margin: '0 0 6px' }}>Total ever</h6>
            {/* Lifetime total, explicitly NOT sealed — see HANDOFF, Mystery jar. */}
            <div className="sj-money" style={{ fontSize: 26, lineHeight: 1.1 }}>
              ${state.totalEver.toFixed(0)}
            </div>
            <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
              Everything you have cashed out
            </div>
          </section>
        </div>

        <section className="sj-panel">
          <h6 className="sj-label" style={{ margin: '0 0 12px' }}>
            Most expensive rule
          </h6>
          {ruleTotals.map((rule) => (
            <Meter
              key={rule.name}
              value={Math.round((rule.amt / maxRule) * 100)}
              valueLabel={veil(rule.amt, sealed)}
              style={RULE_BAR}
            >
              <Label style={RULE_TEXT}>{rule.name}</Label>
              <Meter.Output style={RULE_TEXT} />
              <Meter.Track style={{ borderRadius: 999 }}>
                <Meter.Fill style={{ borderRadius: 999 }} />
              </Meter.Track>
            </Meter>
          ))}
        </section>

        <section className="sj-panel">
          <h6 className="sj-label" style={{ margin: '0 0 12px' }}>
            Worst day of the week
          </h6>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, height: 76 }}>
            {DAYS.map((day, i) => (
              <div
                key={day}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  height: '100%',
                  justifyContent: 'flex-end',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    borderRadius: 8,
                    height: Math.max(6, Math.round((byDay[i] / maxDay) * 58)),
                    background:
                      byDay[i] === maxDay ? 'var(--color-accent-500)' : 'var(--color-accent-200)',
                  }}
                />
                <span className="text-muted" style={{ fontSize: 10 }}>
                  {day.charAt(0)}
                </span>
              </div>
            ))}
          </div>
          <div className="text-muted" style={{ fontSize: 12, marginTop: 10 }}>
            {heaviest
              ? `${heaviest}s cost you the most. Worth a look.`
              : 'Nothing logged yet.'}
          </div>
        </section>
      </div>
    </div>
  );
}
