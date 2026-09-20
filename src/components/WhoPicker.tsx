'use client';

/**
 * "Who" — the two-column pill grid shared by Log a fine and One-off, reading
 * and writing the same draft so switching between them keeps the choice.
 */

import { Avatar } from './Avatar';
import { useStore } from '@/lib/store';
import type { Person } from '@/lib/types';

export function WhoPicker() {
  const { state, dispatch } = useStore();
  const { who } = state.draft;

  // A real jar is solo until the second person joins, and the database will
  // refuse a fine on someone who is not in it. Offering the choice and then
  // swallowing the fine is worse than not offering it — solo use is supposed
  // to work, so fining yourself still does.
  const soloJar = Boolean(state.jar && !state.jar.partnerId);

  const people: { id: Person; name: string }[] = [
    { id: 'A', name: state.me },
    { id: 'S', name: state.partner },
  ];

  return (
    <div className="sj-section">
      <h6 className="sj-label">Who</h6>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {people.map((p) => {
          const on = who === p.id;
          const unavailable = soloJar && p.id === 'S';
          return (
            <button
              key={p.id}
              type="button"
              className="sj-pill sj-pill--who"
              aria-pressed={on}
              disabled={unavailable}
              title={unavailable ? `${p.name} has not joined yet` : undefined}
              onClick={() => dispatch({ type: 'draft/patch', patch: { who: p.id } })}
            >
              <Avatar person={p.id} initial={p.name.charAt(0)} inverted={on} />
              {p.name}
            </button>
          );
        })}
      </div>
      {soloJar && (
        <p className="text-muted" style={{ fontSize: 12, margin: '0 2px' }}>
          {state.partner} has not joined yet — you can still fine yourself.
        </p>
      )}
    </div>
  );
}
