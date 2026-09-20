'use client';

/**
 * Cashed out — the reveal. The amount is never veiled here: cashing out is
 * what opens a Mystery jar.
 *
 * The payload is transient, so a reload or a direct hit has nothing to show
 * and goes back to the jar.
 */

import { Button } from '@heroui/react';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Jar } from '@/components/Jar';
import { money } from '@/lib/money';
import { useStore } from '@/lib/store';

export default function CashedOutPage() {
  const router = useRouter();
  const { state, dispatch } = useStore();
  const cashOut = state.cashOut;

  // Clearing the payload on the way out would otherwise trip the guard below,
  // so the deliberate exit takes itself out of its way.
  const leaving = useRef(false);

  useEffect(() => {
    if (!cashOut && !leaving.current) router.replace('/jar');
  }, [cashOut, router]);

  if (!cashOut) return null;

  function startNewJar() {
    leaving.current = true;
    dispatch({ type: 'cashout/clear' });
    router.push('/jar');
  }

  return (
    <div className="sj-screen sj-screen--centered sj-tinted">
      <Jar
        width={168}
        height={210}
        coins={state.coins}
        fill="var(--color-bg)"
        fillOpacity={0.6}
        showLidShade={false}
        showHighlight={false}
      />

      <div className="text-muted" style={{ fontSize: 13, marginTop: 14 }}>
        Emptied the jar
      </div>
      <div className="sj-money" style={{ fontSize: 48, lineHeight: 1, marginTop: 2 }}>
        {money(cashOut.amt)}
      </div>
      <div style={{ fontSize: 15, marginTop: 8 }}>went to {cashOut.dest}</div>
      <div className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>
        {cashOut.spun ? 'The wheel picked it. No appeals.' : 'Agreed by both of you.'}
      </div>

      <Button
        className="btn btn-primary btn-block"
        variant="primary"
        style={{ height: 54, fontSize: 17, marginTop: 30 }}
        onPress={startNewJar}
      >
        Start a new jar
      </Button>
    </div>
  );
}
