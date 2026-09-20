'use client';

import { Radio, RadioGroup } from '@heroui/react';
import { EmptyState, ListView } from '@heroui-pro/react';
import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
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

/** The empty and unreachable states share a shape; only the sentence differs. */
function Nothing({ title, children }: { title: string; children: ReactNode }) {
  return (
    <EmptyState>
      <EmptyState.Header>
        <EmptyState.Media variant="icon">
          <JarIcon />
        </EmptyState.Media>
        <EmptyState.Title>{title}</EmptyState.Title>
        <EmptyState.Description>{children}</EmptyState.Description>
      </EmptyState.Header>
    </EmptyState>
  );
}

export default function HistoryPage() {
  const { auth, hydrated, remote, sealed, state, syncError } = useStore();
  const [filter, setFilter] = useState<Filter>('all');
  const headingId = useId();

  /*
   * The store drops syncError after five seconds so one refused write cannot
   * become a permanent banner. This screen cannot forget that fast. "The jar
   * could not be reached" and "the jar is empty" are different sentences, and
   * falling back to the second one after five seconds says something the app
   * does not know. The latch lifts the moment a jar or a fine actually lands.
   */
  const [unreachable, setUnreachable] = useState(false);
  useEffect(() => {
    // !auth.userId matters: `remote` is false in the local demo too, so
    // without it a failed fetch latches on and signing out cannot clear it —
    // History would go on saying it could not reach a jar it is no longer
    // trying to reach.
    if (remote || !auth.userId || state.fines.length > 0) setUnreachable(false);
    else if (syncError) setUnreachable(true);
  }, [remote, auth.userId, state.fines.length, syncError]);

  const filters: { id: Filter; name: string }[] = [
    { id: 'all', name: 'Everyone' },
    { id: 'A', name: state.me },
    { id: 'S', name: state.partner },
  ];

  const fines = filter === 'all' ? state.fines : state.fines.filter((f) => f.who === filter);

  // One clock for the whole render, taken after mount. Relative labels read
  // from the clock, and reading it during the server pass would disagree with
  // the client's.
  // Seeded fines carry display strings and never consult the clock, and real
  // ones only exist after hydration — so this never differs across the two
  // passes, and there is no epoch-valued first paint to flash through.
  const now = new Date();

  const groups = groupByRun(fines, now);

  return (
    <div className="sj-screen sj-screen--tabbed">
      <div style={{ padding: '12px 24px 10px' }}>
        <h3 style={{ margin: '0 0 12px' }}>History</h3>
        {/* Three options, one choice, so it is a radio group — and it is one
            all the way down. A single-select ToggleButtonGroup announced
            itself as a radiogroup but was a toolbar underneath: three tab
            stops instead of one, and an arrow key that moved focus without
            moving the selection, which is not what "radio group, Everyone, 1
            of 3" promises. RadioGroup wires the real thing. The selected radio
            is the only tabbable one, and the arrow keys select.

            No heading names this group — the h3 above says "History", which is
            the screen, not the question — so the label stays a string. */}
        <RadioGroup
          aria-label="Whose fines"
          orientation="horizontal"
          value={filter}
          onChange={(next) => {
            if (next === 'all' || next === 'A' || next === 'S') setFilter(next);
          }}
        >
          {filters.map((f) => (
            <Radio key={f.id} value={f.id}>
              <Radio.Content>
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                {f.name}
              </Radio.Content>
            </Radio>
          ))}
        </RadioGroup>
      </div>

      <div className="sj-body" style={{ padding: '4px 24px 20px', gap: 16 }}>
        {groups.map((g, i) => (
          <section key={g.key} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                padding: '0 6px',
              }}
            >
              <h6 className="sj-label" id={`${headingId}g${i}`}>
                {g.when}
              </h6>
              {/* The day subtotal seals with Mystery jar; the rows below do not. */}
              <span className="text-muted" style={{ fontSize: 12 }}>
                {veil(g.subtotal, sealed)}
              </span>
            </div>

            {/* One list per day, named by the day's own heading. The rows are
                read, not operated: no selection, no action, no href. What the
                GridList buys is that a keyboard can get into the ledger at
                all — one stop, then the arrow keys walk the fines.

                The default primary variant is the day card: the kit draws the
                wrapper, rounds the first and last rows and rules the
                separators between them. */}
            <ListView aria-labelledby={`${headingId}g${i}`}>
              {g.rows.map((fine) => (
                <ListView.Item
                  key={fine.id}
                  id={fine.id}
                  textValue={`${displayName(state, fine.who)} — ${fine.label}`}
                >
                  <ListView.ItemContent>
                    <Avatar person={fine.who} initial={initialOf(displayName(state, fine.who))} />
                    {/* The avatar is aria-hidden and the colour-plus-initial disc
                        is the only visual carrier, so name the person for anyone
                        not looking at it. This is the attributed ledger — who a
                        fine is on is the point of the screen. */}
                    <span className="sj-visually-hidden">{displayName(state, fine.who)}</span>
                    <span
                      style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}
                    >
                      <ListView.Title>{fine.label}</ListView.Title>
                      <ListView.Description>
                        {fine.sev} · {rowLabel(fine.when, now)}
                      </ListView.Description>
                    </span>
                  </ListView.ItemContent>
                  <ListView.ItemAction>
                    <span className="sj-money" style={{ fontSize: 16 }}>
                      {money(fine.amt)}
                    </span>
                  </ListView.ItemAction>
                </ListView.Item>
              ))}
            </ListView>
          </section>
        ))}

        {/*
          Three states, and they are not one state. A jar that could not be
          reached says so and keeps saying it; an empty jar says something
          else; and before the store has been read the screen claims neither,
          because it does not yet know which is true. The bug this replaced
          was all three arriving as the same empty array.
        */}
        {groups.length === 0 && unreachable && (
          <Nothing title="Could not reach the jar">The history is where you left it.</Nothing>
        )}

        {/*
          The store sets `hydrated` synchronously on mount while reload() is
          still in flight, so a signed-in jar renders empty for a whole round
          trip. "Nothing yet" is a claim about the jar; it must not be made
          while the jar is still being fetched.
        */}
        {groups.length === 0 && !unreachable && hydrated && auth.userId && !remote && (
          <Nothing title="Fetching the jar…">One moment.</Nothing>
        )}

        {groups.length === 0 && !unreachable && hydrated && (remote || !auth.userId) && (
          <Nothing title="Nothing yet">
            {"Either you've both been good, or someone isn't logging."}
          </Nothing>
        )}
      </div>
    </div>
  );
}
