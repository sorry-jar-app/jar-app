'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/Avatar';
import { Jar } from '@/components/Jar';
import { GameGate } from '@/components/games/GameGate';
import { ScreenHeader } from '@/components/ScreenHeader';
import { prefersReducedMotion } from '@/lib/reducedMotion';
import { displayName, initialOf, useStore } from '@/lib/store';
import { useShake } from '@/lib/useShake';
import { useTilt } from '@/lib/useTilt';
import { COIN_FLOOR } from '@/lib/constants';
import type { Person } from '@/lib/types';



/** How long the coins get to throw themselves about before the reveal. */
const CHURN_MS = 1400;

const LINES = [
  'The coins were quite clear.',
  'Not up for discussion.',
  'Nothing personal. Mostly.',
  'The jar has no favourites. Allegedly.',
];

/**
 * `round` exists for the screen reader, not the screen.
 *
 * Two people and four lines is eight outcomes, so one round in eight repeats
 * the one before it verbatim. React then reuses the DOM, the live region's text
 * never changes, and the announcement simply does not happen — the round that
 * most needs saying out loud is the one that stays silent. Keying on the round
 * remounts the panel regardless.
 */
type Outcome = { who: Person; line: string; round: number };

function WhosItPageScreen() {
  const router = useRouter();
  const { state, dispatch } = useStore();

  const [tumbleKey, setTumbleKey] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [churning, setChurning] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Counts rounds, not renders. See Outcome. */
  const round = useRef(0);
  /** A shake landing mid-round must not start a second one over the top. */
  const busy = useRef(false);

  const { gravity, requestAccess: requestTilt, nudge } = useTilt();

  const decide = useCallback(() => {
    if (busy.current) return;
    busy.current = true;

    // Both picks are made here rather than in render: the app is statically
    // exported, and a random value in a render pass is a hydration bug.
    round.current += 1;
    const result: Outcome = {
      who: Math.random() < 0.5 ? 'A' : 'S',
      line: LINES[Math.floor(Math.random() * LINES.length)],
      round: round.current,
    };

    if (prefersReducedMotion()) {
      setOutcome(result);
      busy.current = false;
      return;
    }

    setOutcome(null);
    setChurning(true);
    setTumbleKey((n) => n + 1);
    timer.current = setTimeout(() => {
      setOutcome(result);
      setChurning(false);
      busy.current = false;
    }, CHURN_MS);
  }, []);

  const { requestAccess: requestShake } = useShake(decide);

  // iOS hands over motion and orientation only from a real gesture, so both
  // asks ride on the button. Everywhere else they are no-ops.
  const shakeIt = useCallback(() => {
    requestTilt();
    requestShake();
    decide();
  }, [requestTilt, requestShake, decide]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function fineThem() {
    if (!outcome) return;
    // Clear first: a draft abandoned earlier would otherwise arrive at /log with
    // a rule and severity already set, one tap from a fine nobody here chose.
    dispatch({ type: 'draft/reset' });
    dispatch({ type: 'draft/patch', patch: { who: outcome.who } });
    router.push('/log');
  }

  const name = outcome ? displayName(state, outcome.who) : '';

  return (
    <div className="sj-screen sj-screen--pushed">
      <ScreenHeader title="Who's it?" backTo="/games" tight />

      <div
        className="sj-body"
        style={{ padding: '4px 24px 14px', gap: 10, alignItems: 'center', textAlign: 'center' }}
      >
        <p className="text-muted" style={{ fontSize: 13, margin: 0, maxWidth: 250 }}>
          Nobody is taking the bins out. Let the jar decide.
        </p>

        {/* flex: none, or the jar is the thing that gets squashed on a short phone. */}
        <div style={{ flex: 'none' }}>
          {/*
            wakeKey, never alwaysOn. Left always on, nineteen coins slide under
            every hand tremor for as long as the screen is open — it outruns
            prefers-reduced-motion and the simulation never gets to sleep. A
            nudge rouses the pile only when "down" has actually moved.
          */}
          <Jar
            width={220}
            height={275}
            coins={Math.max(COIN_FLOOR, state.coins)}
            tumbleKey={tumbleKey}
            gravity={gravity}
            wakeKey={nudge}
          />
        </div>

        <div
          role="status"
          aria-live="polite"
          aria-busy={churning}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 78,
            width: '100%',
          }}
        >
          {outcome && (
            <div
              key={outcome.round}
              className="sj-panel sj-panel--accent"
              style={{ display: 'flex', alignItems: 'center', gap: 12 }}
            >
              <Avatar person={outcome.who} initial={initialOf(name)} size={34} />
              <span style={{ textAlign: 'left' }}>
                <span className="sj-title" style={{ display: 'block', fontSize: 22 }}>
                  {name}
                </span>
                <span className="text-muted" style={{ fontSize: 13 }}>
                  {outcome.line}
                </span>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="sj-footer">
        {outcome ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <button
              type="button"
              className="btn btn-primary btn-block"
              style={{ height: 54, fontSize: 17, marginTop: 0 }}
              onClick={fineThem}
            >
              Log a fine on {name}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              style={{ height: 46, marginTop: 0 }}
              onClick={shakeIt}
            >
              Go again
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-block"
            style={{ height: 54, fontSize: 17, marginTop: 0 }}
            aria-busy={churning}
            disabled={churning}
            onClick={shakeIt}
          >
            {churning ? 'Shaking…' : 'Shake it'}
          </button>
        )}
        <p className="text-muted" style={{ fontSize: 12, textAlign: 'center', margin: '10px 0 0' }}>
          Deciding is free. The fine is still yours to log.
        </p>
      </div>
    </div>
  );
}

/** Locked until the jar is worth enough — see lib/games/catalogue. */
export default function Page() {
  return (
    <GameGate href="/games/whos-it">
      <WhosItPageScreen />
    </GameGate>
  );
}
