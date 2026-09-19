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
          return (
            <button
              key={p.id}
              type="button"
              className="sj-pill sj-pill--who"
              aria-pressed={on}
              onClick={() => dispatch({ type: 'draft/patch', patch: { who: p.id } })}
            >
              <Avatar person={p.id} initial={p.name.charAt(0)} inverted={on} />
              {p.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
