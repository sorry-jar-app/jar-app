'use client';

import { Card, Label, Meter } from '@heroui/react';
import { DAYS } from '@/lib/constants';
import { veil } from '@/lib/money';
import { sumFines, useStore } from '@/lib/store';
import { isTimestamp, WEEKDAYS } from '@/lib/when';
import type { Fine } from '@/lib/types';

/**
 * Stats — four cards over the same fines everyone else reads.
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

  // The two people, in the artwork's own vocabulary. These bars are drawn, not
  // styled — --who-a and --who-s are the same two hues the jar, the coins and
  // the game pieces use, so the chart and the product agree in both modes.
  const owed = [
    { key: 'A', total: meTotal, name: state.me, fill: 'var(--who-a)' },
    { key: 'S', total: partnerTotal, name: state.partner, fill: 'var(--who-s)' },
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
  // card has always claimed to show. Only meaningful once fines carry real
  // timestamps; the seeded display strings have no date to difference.
  const streak = longestCleanRun(state.fines);

  return (
    <div className="sj-screen sj-screen--tabbed">
      <div style={{ padding: '12px 24px 6px' }}>
        <h3 style={{ margin: 0 }}>Stats</h3>
      </div>

      <div className="sj-body" style={{ padding: '8px 24px 20px', gap: 12 }}>
        <Card>
          <Card.Content>
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
          </Card.Content>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Card>
            <Card.Content>
              <h6 className="sj-label" style={{ margin: '0 0 6px' }}>
                Longest streak
              </h6>
              <div className="sj-money" style={{ fontSize: 26, lineHeight: 1.1 }}>
                {streak === null ? '—' : `${streak} day${streak === 1 ? '' : 's'}`}
              </div>
              <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
                {streak === null ? 'Once there is more history' : 'Nobody owing a thing'}
              </div>
            </Card.Content>
          </Card>

          <Card>
            <Card.Content>
              <h6 className="sj-label" style={{ margin: '0 0 6px' }}>
                Total ever
              </h6>
              {/* Lifetime total, explicitly NOT sealed — see HANDOFF, Mystery jar. */}
              <div className="sj-money" style={{ fontSize: 26, lineHeight: 1.1 }}>
                ${state.totalEver.toFixed(0)}
              </div>
              <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
                Everything you have cashed out
              </div>
            </Card.Content>
          </Card>
        </div>

        <Card>
          <Card.Content>
            <h6 className="sj-label" style={{ margin: '0 0 12px' }}>
              Most expensive rule
            </h6>
            {/*
              A Meter is what this row has always been: a quantity in a known
              range, with its name on the left and its figure on the right. The
              kit lays those three parts out on its own grid — label, output,
              track underneath.

              The value is the PERCENTAGE, not the money. aria-valuenow is
              readable whatever the screen says, and Mystery jar would leak
              straight through it; the proportion is what the bar shows anyway,
              sealed or not. The figure rides on valueLabel, which is what both
              the output and aria-valuetext read, so the seal holds in the
              accessibility tree as well as on screen.
            */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {ruleTotals.map((rule) => (
                <Meter
                  key={rule.name}
                  value={Math.round((rule.amt / maxRule) * 100)}
                  valueLabel={veil(rule.amt, sealed)}
                >
                  <Label>{rule.name}</Label>
                  <Meter.Output />
                  <Meter.Track>
                    <Meter.Fill />
                  </Meter.Track>
                </Meter>
              ))}
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Content>
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
                  {/* Drawn bars, same vocabulary as the pair above: the heaviest
                      day takes the A hue solid, the rest its soft step. */}
                  <div
                    style={{
                      width: '100%',
                      borderRadius: 8,
                      height: Math.max(6, Math.round((byDay[i] / maxDay) * 58)),
                      background: byDay[i] === maxDay ? 'var(--who-a)' : 'var(--who-a-soft)',
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
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}
