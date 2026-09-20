'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card } from '@heroui/react';
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

/**
 * The jar's own units — the viewBox inside <Jar>, not pixels.
 *
 * <Jar> takes width and height as numbers and writes them onto the svg as an
 * inline style, so the stylesheet cannot size it: the field has to be measured
 * and the numbers handed over. These two are only the ratio that measurement
 * fits into, and they must track the component's viewBox exactly or the jar
 * letterboxes inside its own box.
 */
const JAR_VIEW_W = 200;
const JAR_VIEW_H = 250;

/**
 * Room kept for the result, so the jar is not resized by its own answer.
 *
 * The field takes whatever is left over; if that "left over" changed the
 * moment a result landed, the jar would jump a hundred pixels at exactly the
 * moment you are looking at it. Reserving the panel's height up front costs a
 * little glass and buys a still reveal.
 */
const RESULT_MIN_H = 88;

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

  /**
   * The field is a different size on every screen, so the jar is measured, not
   * declared. Largest 200×250 box that fits, which is what object-fit: contain
   * would do if an svg with an inline width could be talked out of it.
   *
   * This converges rather than chases itself: .sj-field is `flex: 1 1 auto`
   * inside a column whose height is fixed, so its height settles at "whatever
   * the instruction line, the result panel and the gaps leave", a figure the
   * jar's own size drops out of. The epsilon stops the observer re-firing on a
   * sub-pixel, and .sj-field > svg { max-height: 100% } is the backstop if a
   * measurement is ever stale.
   */
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const [jarBox, setJarBox] = useState({ width: JAR_VIEW_W, height: JAR_VIEW_H });

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;

    const fit = () => {
      const { width, height } = field.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      const scale = Math.min(width / JAR_VIEW_W, height / JAR_VIEW_H);
      setJarBox((prev) =>
        Math.abs(prev.height - JAR_VIEW_H * scale) < 0.5
          ? prev
          : { width: JAR_VIEW_W * scale, height: JAR_VIEW_H * scale },
      );
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(field);
    return () => observer.disconnect();
  }, []);

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

        {/* The board is the screen. 200×250 is taller than wide, so --tall. */}
        <div ref={fieldRef} className="sj-field sj-field--tall">
          {/*
            wakeKey, never alwaysOn. Left always on, nineteen coins slide under
            every hand tremor for as long as the screen is open — it outruns
            prefers-reduced-motion and the simulation never gets to sleep. A
            nudge rouses the pile only when "down" has actually moved.
          */}
          <Jar
            width={jarBox.width}
            height={jarBox.height}
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
            minHeight: RESULT_MIN_H,
            width: '100%',
          }}
        >
          {outcome && (
            <Card key={outcome.round}>
              <Card.Content>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
              </Card.Content>
            </Card>
          )}
        </div>
      </div>

      <div className="sj-footer">
        {/*
          The shake button is written once, outside the branch, on purpose. A
          round ending swaps one button for two, and had this been the second
          arm of a ternary React would have torn the old node down — taking the
          focus of anyone who got here by keyboard with it, at the exact moment
          there is something new to read. Held at a fixed position in the child
          list it keeps its DOM node, its focus, and its job: shake again.
        */}
        <div className="sj-stack">
          {outcome && (
            <Button size="lg" fullWidth onPress={fineThem}>
              Log a fine on {name}
            </Button>
          )}
          {/*
            aria-disabled, never disabled: a real disabled attribute drops the
            button out of the tab order mid-press and the focus goes to the
            document. Neither attribute survives HeroUI's Button on its own, so
            the render function puts them back. A press that lands anyway is
            caught by the busy guard in decide().
          */}
          <Button
            variant={outcome ? 'secondary' : 'primary'}
            size="lg"
            fullWidth
            render={(props) => (
              <button {...props} aria-busy={churning} aria-disabled={churning || undefined} />
            )}
            onPress={shakeIt}
          >
            {outcome ? 'Go again' : churning ? 'Shaking…' : 'Shake it'}
          </Button>
        </div>
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
