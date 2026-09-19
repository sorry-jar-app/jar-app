'use client';

/**
 * Cash out — pick where the jar goes, then empty it.
 *
 * The total seals under Mystery jar; the CTA's figure does not, because the
 * prototype swaps the whole label for "Cash out and reveal" the moment Mystery
 * jar is on, Peek or no Peek.
 */

import { startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ScreenHeader } from '@/components/ScreenHeader';
import { DESTINATIONS } from '@/lib/constants';
import { money, veil } from '@/lib/money';
import { sumFines, useStore } from '@/lib/store';

export default function CashOutPage() {
  const router = useRouter();
  const { state, dispatch, sealed } = useStore();

  const total = sumFines(state.fines);

  function handleCashOut() {
    // Picked at click time, not during render: a random number in the render
    // pass would differ between the server HTML and the first client pass.
    const pick = Math.floor(Math.random() * 3);
    // One transition for both. Dispatching urgently would repaint this screen
    // from the emptied store — $0.00, "0 fines, all forgiven" — in the gap
    // before /cashed-out mounts.
    startTransition(() => {
      dispatch({ type: 'cashout', pick });
      router.replace('/cashed-out');
    });
  }

  return (
    <div className="sj-screen sj-screen--pushed">
      <ScreenHeader title="Spend the jar" backTo="/jar" tight />

      <div className="sj-body" style={{ padding: '14px 24px 18px', gap: 16 }}>
        <div style={{ textAlign: 'center', padding: '20px 0 4px' }}>
          <div className="sj-money" style={{ fontSize: 56, lineHeight: 1 }}>
            {veil(total, sealed)}
          </div>
          <div className="text-muted" style={{ fontSize: 13 }}>
            {state.fines.length} fines, all forgiven
          </div>
        </div>

        <div className="sj-section" style={{ gap: 9 }}>
          <h6 className="sj-label">Where&apos;s it going</h6>
          {DESTINATIONS.map((d) => {
            const on = state.dest === d.id;
            return (
              <button
                key={d.id}
                type="button"
                className="sj-surface-row"
                aria-pressed={on}
                style={
                  on
                    ? { background: 'var(--color-accent-100)', borderColor: 'var(--color-accent)' }
                    : undefined
                }
                onClick={() => dispatch({ type: 'dest/set', dest: d.id })}
              >
                <span className="sj-radio" data-on={on ? 'true' : undefined} aria-hidden="true" />
                <span style={{ flex: 1 }}>
                  <span style={{ fontSize: 15, display: 'block' }}>{d.name}</span>
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    {d.note}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="sj-footer">
        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ height: 54, fontSize: 17, marginTop: 0 }}
          onClick={handleCashOut}
        >
          {state.mystery ? 'Cash out and reveal' : `Cash out ${money(total)}`}
        </button>
        <p className="text-muted" style={{ fontSize: 12, textAlign: 'center', margin: '10px 0 0' }}>
          This empties the jar and starts a fresh one.
        </p>
      </div>
    </div>
  );
}
