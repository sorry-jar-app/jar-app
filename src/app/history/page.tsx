'use client';

import { Radio, RadioGroup } from '@heroui/react';
import { EmptyState, ListView } from '@heroui-pro/react';
import { useEffect, useId, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
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

/*
 * The filter pills, on HeroUI's terms.
 *
 * Nearly all of what this used to say has gone with the toggle button.
 * .toggle-button was a fixed 40px control that painted its own fills through
 * rules app.css could not outrank, so the height and every colour had to be
 * pinned back. .radio__content is none of that: no height, no background, no
 * hover — HeroUI paints selection on .radio__control, which this group does
 * not render — so .sj-pill and .sj-pill[data-on='true'] are left to do the
 * whole job unopposed.
 *
 * Two things are left, and they are the two the classes cannot say.
 *
 * white-space, because .toggle-button carried `whitespace-nowrap` and
 * .radio__content does not, and app.css never gives .sj-pill one. The names
 * in this row are the two people's own, and a long one would wrap inside its
 * pill rather than run the row wide.
 *
 * And the focus ring, because the box that takes focus is no longer the box
 * you can see. The real target is the native input, and organic.css:166 has
 * it at opacity 0 — a ring drawn there is a ring drawn on nothing. HeroUI
 * rings .radio__control instead, which this group omits. So the ring is asked
 * for here, on the pill, in the app's own terms, which is where it sat when
 * the pill was a button.
 */
function filterPillStyle({ isFocusVisible }: { isFocusVisible: boolean }): CSSProperties {
  return {
    whiteSpace: 'nowrap',
    ...(isFocusVisible ? { outline: '2px solid var(--color-accent)', outlineOffset: 2 } : null),
  };
}

/**
 * The fine row.
 *
 * .list-view--secondary paints its items transparent and rules a line under
 * each one at a specificity app.css cannot reach, so .sj-row--pill's fill has
 * to be set here and the line taken off. The hover tint reads React Aria's
 * isHovered rather than CSS :hover: a tap on a phone leaves :hover stuck on
 * the row it landed on, and the fill is the one thing that would stay behind.
 * Nothing in the list is pressable, so the cursor says so.
 */
function rowStyle({ isHovered }: { isHovered: boolean }): CSSProperties {
  return {
    background: isHovered
      ? 'color-mix(in srgb, var(--color-text) 5%, transparent)'
      : 'var(--color-surface)',
    borderBottom: 'none',
    cursor: 'default',
  };
}

/** The empty and unreachable states share a shape; only the sentence differs. */
function Nothing({
  ink,
  title,
  children,
}: {
  ink: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <EmptyState style={{ padding: '60px 20px', gap: 6 }}>
      <EmptyState.Header style={{ gap: 6 }}>
        <EmptyState.Media>
          <JarIcon size={44} stroke={ink} />
        </EmptyState.Media>
        {/* h3 takes the heading face from organic.css; .empty-state__title
            forces 600 onto it, and Caprasimo only has 400. */}
        <EmptyState.Title style={{ fontSize: 20, fontWeight: 400, marginTop: 6 }}>
          {title}
        </EmptyState.Title>
        <EmptyState.Description className="text-muted" style={{ fontSize: 13, maxWidth: 220 }}>
          {children}
        </EmptyState.Description>
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
        {/* Three pills, one choice, so it is a radio group — and now it is
            one all the way down. A single-select ToggleButtonGroup announced
            itself as a radiogroup but was a toolbar underneath: three tab
            stops instead of one, and an arrow key that moved focus without
            moving the selection, which is not what "radio group, Everyone, 1
            of 3" promises. RadioGroup wires the real thing. The selected
            radio is the only tabbable one, and the arrow keys select.

            No heading names this group — the h3 above says "History", which
            is the screen, not the question — so the label stays a string.

            The checked state is a real <input type="radio" checked>, so there
            is no aria-pressed left to hook and no aria-checked either. The
            fill stays on data-on — .sj-pill[data-on='true'] is already in
            app.css, and it is unlayered, so it beats HeroUI. */}
        <RadioGroup
          aria-label="Whose fines"
          orientation="horizontal"
          value={filter}
          onChange={(next) => {
            if (next === 'all' || next === 'A' || next === 'S') setFilter(next);
          }}
          // .radio-group is a block-level, wrapping flex row at gap-4 when
          // horizontal. The row it replaces was an inline-flex, centred, that
          // could not wrap, at 7. Stated in full so it is the same row.
          style={{ display: 'inline-flex', flexWrap: 'nowrap', alignItems: 'center', gap: 7 }}
        >
          {filters.map((f) => (
            // The pill classes belong on Radio.Content: that is the <label>,
            // and the thing you can see and press. Radio is the field wrapper
            // around it. No Radio.Control and no Radio.Indicator — the pill
            // is its own indicator, and an empty 16px circle would be sitting
            // inside it.
            <Radio key={f.id} value={f.id}>
              <Radio.Content
                className="sj-pill sj-pill--filter"
                data-on={filter === f.id}
                style={filterPillStyle}
              >
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
              <h6 className="sj-label sj-label--faint" id={`${headingId}g${i}`}>
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
                all — one stop, then the arrow keys walk the fines. */}
            <ListView
              aria-labelledby={`${headingId}g${i}`}
              variant="secondary"
              style={{ display: 'flex', flexDirection: 'column', gap: 7 }}
            >
              {g.rows.map((fine) => (
                <ListView.Item
                  key={fine.id}
                  id={fine.id}
                  textValue={`${displayName(state, fine.who)} — ${fine.label}`}
                  className="sj-row sj-row--pill"
                  style={rowStyle}
                >
                  <ListView.ItemContent style={{ gap: 11 }}>
                    <Avatar
                      person={fine.who}
                      initial={initialOf(displayName(state, fine.who))}
                    />
                    {/* The avatar is aria-hidden and the colour-plus-initial disc
                        is the only visual carrier, so name the person for anyone
                        not looking at it. This is the attributed ledger — who a
                        fine is on is the point of the screen. */}
                    <span className="sj-visually-hidden">{displayName(state, fine.who)}</span>
                    <span
                      style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}
                    >
                      <ListView.Title style={{ fontSize: 14, fontWeight: 400 }}>
                        {fine.label}
                      </ListView.Title>
                      <ListView.Description style={{ fontSize: 11 }}>
                        {fine.sev} · {rowLabel(fine.when, now)}
                      </ListView.Description>
                    </span>
                  </ListView.ItemContent>
                  <ListView.ItemAction style={{ paddingInlineStart: 0 }}>
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
          <Nothing ink="var(--color-neutral-400)" title="Could not reach the jar">
            The history is where you left it.
          </Nothing>
        )}

        {/*
          The store sets `hydrated` synchronously on mount while reload() is
          still in flight, so a signed-in jar renders empty for a whole round
          trip. "Nothing yet" is a claim about the jar; it must not be made
          while the jar is still being fetched.
        */}
        {groups.length === 0 && !unreachable && hydrated && auth.userId && !remote && (
          <Nothing ink="var(--color-accent-300)" title="Fetching the jar…">
            One moment.
          </Nothing>
        )}

        {groups.length === 0 && !unreachable && hydrated && (remote || !auth.userId) && (
          <Nothing ink="var(--color-accent-300)" title="Nothing yet">
            {"Either you've both been good, or someone isn't logging."}
          </Nothing>
        )}
      </div>
    </div>
  );
}
