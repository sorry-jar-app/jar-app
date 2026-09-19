'use client';

/**
 * Fine landed — the confirmation, and the only place a fine can be reversed.
 *
 * The jar here washes with --color-bg rather than the accent, and drops the
 * highlight arc, because the whole screen already sits on the accent-100
 * ground.
 */

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Jar } from '@/components/Jar';
import { money } from '@/lib/money';
import { displayName, useStore } from '@/lib/store';

export default function LandedPage() {
  const router = useRouter();
  const { state, dispatch } = useStore();
  const { lastFine } = state;

  // Latch the flag on the first render. The effect below clears it from the
  // store so a return visit is static, and reading it here first keeps that
  // clear from cancelling the animation this render is already showing.
  const animate = useRef(state.animCoin).current;

  useEffect(() => {
    dispatch({ type: 'fine/clearAnim' });
  }, []);

  // A deliberate exit nulls lastFine itself, so latch it out of the guard's
  // way — otherwise Undo's own push races the guard's replace.
  const leaving = useRef(false);

  // No fine to confirm: a direct visit, or a reload after Undo.
  useEffect(() => {
    if (!lastFine && !leaving.current) router.replace('/jar');
  }, [lastFine, router]);

  if (!lastFine) return null;

  const fined = displayName(state, lastFine.who);
  const notified = displayName(state, lastFine.who === 'A' ? 'S' : 'A');

  const undo = () => {
    leaving.current = true;
    dispatch({ type: 'fine/undo' });
    router.push('/jar');
  };

  return (
    <div className="sj-screen sj-screen--centered sj-tinted">
      <Jar
        width={190}
        height={238}
        coins={state.coins}
        animateLast={animate}
        nudge={animate}
        fill="var(--color-bg)"
        fillOpacity={0.6}
        showHighlight={false}
      />

      {/* Never veiled: an individual fine amount stays readable in Mystery jar. */}
      <div className="sj-money" style={{ fontSize: 44, lineHeight: 1, marginTop: 10 }}>
        {money(lastFine.amt)}
      </div>
      <div style={{ fontSize: 14, marginTop: 6 }}>
        {fined} · {lastFine.label}
      </div>
      <div className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>
        {notified} just got a notification.
      </div>

      <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 26 }}>
        <button type="button" className="btn btn-secondary" style={{ flex: 1, height: 50 }} onClick={undo}>
          Undo
        </button>
        <button
          type="button"
          className="btn btn-primary"
          style={{ flex: 1, height: 50 }}
          onClick={() => router.push('/jar')}
        >
          Done
        </button>
      </div>
    </div>
  );
}
