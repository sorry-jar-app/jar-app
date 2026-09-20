'use client';

import { useEffect, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { JarIcon } from '@/components/Icons';
import { money, veil } from '@/lib/money';
import { displayName, initialOf, useStore } from '@/lib/store';
import { groupLabel, rowLabel } from '@/lib/when';
import type { Fine, Person } from '@/lib/types';

type Filter = 'all' | Person;

type Group = {
  key: string;
  when: string;
  subtotal: number;
  rows: Fine[];
};

/**
 * Group consecutive fines that fall under the same day heading.
 *
 * Grouped on the LABEL, not the raw `when`: a real fine carries an ISO
 * timestamp, which is unique per fine, so grouping on it raw would put every
 * fine in a group of its own. Seed fines carry a display string, which
 * groupLabel passes straight through, so both kinds sit in one list.
 *
 * Consecutive, and not a Map: the list is newest-first and the same heading
 * can come round again further down (two "Tuesday" runs a fortnight apart),
 * and those are two groups, not one.
 */
function groupByRun(fines: Fine[], now: Date): Group[] {
  const groups: Group[] = [];

  for (const fine of fines) {
    const label = groupLabel(fine.when, now);
    const open = groups[groups.length - 1];
    if (open && open.when === label) {
      open.rows.push(fine);
      open.subtotal += fine.amt;
    } else {
      groups.push({
        key: label + '-' + fine.id,
        when: label,
        subtotal: fine.amt,
        rows: [fine],
      });
    }
  }

  return groups;
}

export default function HistoryPage() {
  const { state, sealed } = useStore();
  const [filter, setFilter] = useState<Filter>('all');

  const filters: { id: Filter; name: string }[] = [
    { id: 'all', name: 'Everyone' },
    { id: 'A', name: state.me },
    { id: 'S', name: state.partner },
  ];

  const fines = filter === 'all' ? state.fines : state.fines.filter((f) => f.who === filter);

  // One clock for the whole render, taken after mount. Relative labels read
  // from the clock, and reading it during the server pass would disagree with
  // the client's. Seeded fines carry display strings and are unaffected, but
  // real ones are timestamps.
  // Seeded fines carry display strings and never consult the clock, and real
  // ones only exist after hydration — so this never differs across the two
  // passes, and there is no epoch-valued first paint to flash through.
  const now = new Date();

  const groups = groupByRun(fines, now);

  return (
    <div className="sj-screen sj-screen--tabbed">
      <div style={{ padding: '12px 24px 10px' }}>
        <h3 style={{ margin: '0 0 12px' }}>History</h3>
        <div style={{ display: 'flex', gap: 7 }}>
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              className="sj-pill sj-pill--filter"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      <div className="sj-body" style={{ padding: '4px 24px 20px', gap: 16 }}>
        {groups.map((g) => (
          <div key={g.key} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                padding: '0 6px',
              }}
            >
              <h6 className="sj-label sj-label--faint">{g.when}</h6>
              {/* The day subtotal seals with Mystery jar; the rows below do not. */}
              <span className="text-muted" style={{ fontSize: 12 }}>
                {veil(g.subtotal, sealed)}
              </span>
            </div>

            {g.rows.map((fine) => (
              <div key={fine.id} className="sj-row sj-row--pill">
                <Avatar
                  person={fine.who}
                  initial={initialOf(displayName(state, fine.who))}
                />
                {/* The avatar is aria-hidden and the colour-plus-initial disc
                    is the only visual carrier, so name the person for anyone
                    not looking at it. This is the attributed ledger — who a
                    fine is on is the point of the screen. */}
                <span className="sj-visually-hidden">{displayName(state, fine.who)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 14 }}>{fine.label}</span>
                  <span className="text-muted" style={{ fontSize: 11, display: 'block' }}>
                    {fine.sev} · {rowLabel(fine.when, now)}
                  </span>
                </span>
                <span className="sj-money" style={{ fontSize: 16 }}>
                  {money(fine.amt)}
                </span>
              </div>
            ))}
          </div>
        ))}

        {groups.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              padding: '60px 20px',
              textAlign: 'center',
            }}
          >
            <JarIcon size={44} stroke="var(--color-accent-300)" />
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 20, marginTop: 6 }}>
              Nothing yet
            </div>
            <p className="text-muted" style={{ fontSize: 13, margin: 0, maxWidth: 220 }}>
              {"Either you've both been good, or someone isn't logging."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
