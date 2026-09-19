'use client';

import { DAYS } from '@/lib/constants';
import { veil } from '@/lib/money';
import { sumFines, useStore } from '@/lib/store';

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

  return (
    <div className="sj-screen sj-screen--tabbed">
      <div style={{ padding: '12px 24px 6px' }}>
        <h3 style={{ margin: 0 }}>Stats</h3>
      </div>

      <div className="sj-body" style={{ padding: '8px 24px 20px', gap: 12 }}>
        <section className="sj-panel">
          <h6 className="sj-label" style={{ margin: '0 0 12px' }}>
            Who owes more this month
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
              9 days
            </div>
            <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
              {state.partner}, in June
            </div>
          </section>

          <section className="sj-panel sj-panel--sage">
            <h6 style={{ margin: '0 0 6px' }}>Total ever</h6>
            {/* Lifetime total, explicitly NOT sealed — see HANDOFF, Mystery jar. */}
            <div className="sj-money" style={{ fontSize: 26, lineHeight: 1.1 }}>
              ${state.totalEver.toFixed(0)}
            </div>
            <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
              Across 3 jars
            </div>
          </section>
        </div>

        <section className="sj-panel">
          <h6 className="sj-label" style={{ margin: '0 0 12px' }}>
            Most expensive rule
          </h6>
          {ruleTotals.map((rule) => (
            <div
              key={rule.name}
              style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 11 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{rule.name}</span>
                <span>{veil(rule.amt, sealed)}</span>
              </div>
              <div className="sj-bar-track">
                <div
                  style={{
                    height: '100%',
                    background: 'var(--color-accent-500)',
                    width: `${Math.round((rule.amt / maxRule) * 100)}%`,
                  }}
                />
              </div>
            </div>
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
            Tuesdays cost you the most. Worth a look.
          </div>
        </section>
      </div>
    </div>
  );
}
