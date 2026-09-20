'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card } from '@heroui/react';
import { GameGate } from '@/components/games/GameGate';
import { ScreenHeader } from '@/components/ScreenHeader';
import { JAR_BODY_PATH } from '@/lib/constants';
import { useReducedMotion } from '@/lib/reducedMotion';
import { livesFrom } from '@/lib/games/catalogue';
import { useStore } from '@/lib/store';
import { useTilt } from '@/lib/useTilt';
import {
  BALL_R,
  BRICK_COUNT,
  CENTRE_X,
  PADDLE_H,
  PADDLE_MAX_X,
  PADDLE_MIN_X,
  PADDLE_W,
  PADDLE_Y,
  VIEW_H,
  VIEW_W,
  newGame,
  restart,
  serve,
  step,
  type Game,
} from '@/lib/games/breaker';

/** How far a tilt has to go to push the paddle to the wall. */
const TILT_SPAN = 110;
/** Arrow-key travel, in viewBox units per second. */
const KEY_SPEED = 300;
/** How long a finger or a key keeps the paddle before the tilt takes it back. */
const MANUAL_HOLD_MS = 1200;
/** The beat between losing the ball and the next serve. */
const PAUSE_MS = 700;

/**
 * A ball in the meter. Artwork, not a component — there is nothing in the kit
 * that is one small mark repeated, and a Meter would print a figure.
 */
const DOT: CSSProperties = { width: 8, height: 8, borderRadius: 999, display: 'block' };

const CLEARED_LINES = [
  'Nothing was earned. That was the deal.',
  'The jar is unmoved. As ever.',
  'Nobody owes anybody anything. Yet.',
];

const LOST_LINES = [
  'It has had a lot of practice.',
  'The wall did not blink.',
  'Not your finest. We can move on.',
];

type Phase = 'idle' | 'playing' | 'done';
type Result = { title: string; line: string; key: number };

function BreakerPageScreen() {
  const router = useRouter();
  const { state, dispatch } = useStore();

  // A coin in the jar is a ball. Everyone starts with one, and every fine buys
  // another — so the jar you are playing with is the one on the home screen.
  const allowance = livesFrom(state.coins);
  const reduced = useReducedMotion();
  const { gravity, requestAccess: requestTilt, supported } = useTilt();

  const [phase, setPhase] = useState<Phase>('idle');
  const [lives, setLives] = useState(allowance);

  /**
   * The allowance as of this render, for the callbacks to read.
   *
   * `begin` and `stop` are built once and would otherwise hold the first
   * render's figure forever — and the first render is reliably the wrong one.
   * The store hydrates from localStorage synchronously, which is all GameGate
   * waits for, while the real jar arrives later off getSession -> loadJar and
   * recomputes `coins` from the fines. So the screen would say seventeen balls
   * and serve one. Any fine landing over realtime moves it again, mid-session.
   */
  const allowanceRef = useRef(allowance);
  useEffect(() => {
    allowanceRef.current = allowance;
    // Between rounds the meter should follow the jar. Mid-round it must not:
    // a fine landing while you are playing would silently top your balls back
    // up, and the count on screen would stop matching the one in the game.
    if (phase !== 'playing') setLives(allowance);
  }, [allowance, phase]);
  const [cleared, setCleared] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  // One dot per ball the jar bought — but only while they fit. Nineteen dots
  // across a phone is a dashed line, not a count, and a row silently clipped at
  // eight would sit there fully lit while the first eleven balls were lost.
  // Past the cap it becomes a single marker and a numeral, which moves every
  // time.
  const DOT_CAP = 8;
  const dotted = allowance <= DOT_CAP;
  const dots = Array.from({ length: allowance }, (_, i) => i);

  // Built once, with a fixed lean rather than a random one: this runs in render
  // on both the static pass and the client, and the two have to agree. Every
  // later serve gets a real random lean, from a handler.
  const gameRef = useRef<Game | null>(null);
  if (gameRef.current === null) gameRef.current = newGame(() => 0.5, allowance);
  const game = gameRef.current;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const ballRef = useRef<SVGCircleElement | null>(null);
  const paddleRef = useRef<SVGRectElement | null>(null);
  const brickRefs = useRef<(SVGRectElement | null)[]>([]);

  /** Where a finger or an arrow key last asked the paddle to be. */
  const manualX = useRef(CENTRE_X);
  const manualAt = useRef(0);
  const dragging = useRef(false);
  const held = useRef({ left: false, right: false });
  const serveAt = useRef(0);
  const shownCleared = useRef(0);
  const paintedCleared = useRef(0);
  const resultKey = useRef(0);

  // Read every frame by the loop, so neither may tear it down.
  const tiltReady = useRef(false);
  tiltReady.current = supported;

  const paint = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;

    ballRef.current?.setAttribute('cx', g.ball.x.toFixed(2));
    ballRef.current?.setAttribute('cy', g.ball.y.toFixed(2));
    paddleRef.current?.setAttribute('x', (g.paddle.x - g.paddle.w / 2).toFixed(2));

    if (paintedCleared.current !== g.cleared) {
      paintedCleared.current = g.cleared;
      for (let i = 0; i < g.bricks.length; i++) {
        const node = brickRefs.current[i];
        // A broken brick goes to the spent colour rather than disappearing, so
        // the wall keeps its shape and how much is left stays readable at a
        // glance. Clearing the inline fill hands the brick back to its own.
        if (node) node.style.fill = g.bricks[i].alive ? '' : 'var(--piece-dead)';
      }
    }
  }, []);

  const finish = useCallback((won: boolean) => {
    const lines = won ? CLEARED_LINES : LOST_LINES;
    resultKey.current += 1;
    setResult({
      title: won ? 'Wall down.' : 'Wall wins.',
      line: lines[Math.floor(Math.random() * lines.length)],
      key: resultKey.current,
    });
    setPhase('done');
  }, []);

  useEffect(() => {
    if (phase !== 'playing' || reduced) return;
    const g = gameRef.current;
    if (!g) return;

    let last = performance.now();

    const frame = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;

      // A held arrow key is integrated rather than stepped, so it glides.
      const dir = (held.current.right ? 1 : 0) - (held.current.left ? 1 : 0);
      if (dir !== 0) {
        const span = Math.min(dt, 1 / 30);
        manualX.current = Math.max(
          PADDLE_MIN_X,
          Math.min(PADDLE_MAX_X, manualX.current + dir * KEY_SPEED * span),
        );
        manualAt.current = now;
      }

      // Not while a finger is on the glass. Parking the paddle at a wall to
      // wait for the ball is the most ordinary thing a player does, and a still
      // thumb fires no pointermove — so on the timestamp alone the paddle was
      // handed back to a gamma of roughly nothing and snapped to centre out
      // from under them.
      const onTilt =
        tiltReady.current && !dragging.current && now - manualAt.current > MANUAL_HOLD_MS;
      const target = onTilt ? CENTRE_X + gravity.current.x * TILT_SPAN : manualX.current;

      const outcome = step(g, dt, target);
      paint();

      if (shownCleared.current !== g.cleared) {
        shownCleared.current = g.cleared;
        setCleared(g.cleared);
      }

      if (outcome === 'cleared') {
        finish(true);
        return;
      }
      if (outcome === 'lost-ball') {
        setLives(g.lives);
        if (g.lives <= 0) {
          finish(false);
          return;
        }
        serveAt.current = now + PAUSE_MS;
      }
      if (serveAt.current !== 0 && now >= serveAt.current) {
        serveAt.current = 0;
        serve(g);
      }

      raf = requestAnimationFrame(frame);
    };

    let raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, reduced, gravity, paint, finish]);

  useEffect(() => {
    if (phase !== 'playing') return;

    const down = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') held.current.left = true;
      else if (event.key === 'ArrowRight') held.current.right = true;
      else return;
      event.preventDefault();
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') held.current.left = false;
      else if (event.key === 'ArrowRight') held.current.right = false;
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      held.current.left = false;
      held.current.right = false;
    };
  }, [phase]);

  useEffect(() => {
    paint();
  }, [paint]);

  /**
   * Map a finger to a place on the wall.
   *
   * Measured off the live <svg>, every time. The board is no longer a fixed
   * 216px — it grows to whatever is left between the meter and the footer, and
   * it is letterboxed inside a full-width field, so the wrapper's box is wider
   * than the board on every screen. Measuring the wrapper would have put the
   * paddle consistently short of the finger, and by a different amount on each
   * device. A stored constant would be worse.
   */
  const aim = useCallback((clientX: number) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    manualX.current = ((clientX - box.left) / box.width) * VIEW_W;
    manualAt.current = performance.now();
  }, []);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    aim(event.clientX);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (dragging.current) aim(event.clientX);
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    dragging.current = false;
    // Start the hold window at the release, not at the last movement.
    manualAt.current = performance.now();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const begin = useCallback(() => {
    // iOS hands over orientation only from a real gesture, so the ask rides the
    // button that starts the round. Everywhere else it is a no-op.
    requestTilt();
    const g = gameRef.current;
    if (!g) return;

    restart(g, Math.random, allowanceRef.current);
    manualX.current = g.paddle.x;
    manualAt.current = 0;
    serveAt.current = 0;
    shownCleared.current = 0;
    setLives(g.lives);
    setCleared(0);
    setResult(null);
    paint();
    setPhase('playing');
  }, [requestTilt, paint]);

  const stop = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    restart(g, Math.random, allowanceRef.current);
    serveAt.current = 0;
    shownCleared.current = 0;
    setLives(g.lives);
    setCleared(0);
    setResult(null);
    paint();
    setPhase('idle');
  }, [paint]);

  function ownUp() {
    // Clear first: a draft abandoned earlier would otherwise arrive at /log with
    // a rule and severity already set, one tap from a fine nobody here chose.
    dispatch({ type: 'draft/reset' });
    dispatch({ type: 'draft/patch', patch: { who: 'A' } });
    router.push('/log');
  }

  if (reduced) {
    return (
      <div className="sj-screen sj-screen--pushed">
        <ScreenHeader title="Breaker" backTo="/games" tight />

        <div
          className="sj-body"
          style={{
            padding: '4px 24px 14px',
            gap: 10,
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <div style={{ width: '100%', maxWidth: 300 }}>
            <Card>
              <Card.Header>
                <Card.Title>This one moves.</Card.Title>
                <Card.Description>
                  Breaker is a coin bouncing at speed, and there is no honest way to play it
                  still. Your device asks for less motion, so it sits this one out.
                </Card.Description>
              </Card.Header>
            </Card>
          </div>
        </div>

        <div className="sj-footer">
          <Button size="lg" fullWidth onPress={() => router.push('/games')}>
            Back to games
          </Button>
          <p className="text-muted" style={{ fontSize: 12, textAlign: 'center', margin: '10px 0 0' }}>
            Who&rsquo;s it? settles an argument without any of this.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="sj-screen sj-screen--pushed">
      <ScreenHeader title="Breaker" backTo="/games" tight />

      <div
        className="sj-body"
        style={{ padding: '4px 24px 14px', gap: 10, alignItems: 'center', textAlign: 'center' }}
      >
        <p className="text-muted" style={{ fontSize: 13, margin: 0, maxWidth: 250, flex: 'none' }}>
          {allowance === 1 ? 'One ball' : `${allowance} balls`}. Drag the paddle, tilt the phone, or
            use the arrow keys.
        </p>

        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', flex: 'none' }}
        >
          <span className="sj-visually-hidden">
            {lives} of {allowance} {allowance === 1 ? 'ball' : 'balls'} left. {cleared} of{' '}
            {BRICK_COUNT} bricks down.
          </span>
          <span
            aria-hidden="true"
            style={{ display: 'flex', gap: 4, flex: 'none', alignItems: 'center' }}
          >
            {dotted ? (
              dots.map((i) => (
                <span
                  key={i}
                  style={{ ...DOT, background: i < lives ? 'var(--who-a)' : 'var(--piece-dead)' }}
                />
              ))
            ) : (
              <>
                <span
                  style={{ ...DOT, background: lives > 0 ? 'var(--who-a)' : 'var(--piece-dead)' }}
                />
                <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{lives}</span>
              </>
            )}
          </span>
          <span
            aria-hidden="true"
            style={{
              flex: 1,
              height: 6,
              borderRadius: 999,
              overflow: 'hidden',
              background: 'var(--piece-dead)',
            }}
          >
            <span
              style={{
                display: 'block',
                height: '100%',
                borderRadius: 999,
                // The same hue as the ball dots beside it, on purpose. --who-a
                // and --who-s are the two people everywhere else in the app, so
                // pairing them across a 10px gap would read as a split between
                // two players when both halves are one player's.
                background: 'var(--who-a)',
                width: `${(cleared / BRICK_COUNT) * 100}%`,
              }}
            />
          </span>
        </div>

        {/*
          The board is the screen. .sj-field takes everything left between the
          meter and the footer and sizes the svg off its own viewBox, which is
          untouched — every constant in lib/games/breaker is in those units.
        */}
        <div
          className="sj-field sj-field--tall"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <svg ref={svgRef} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} aria-hidden="true">
            <defs>
              <clipPath id="breaker-jar">
                <path d={JAR_BODY_PATH} />
              </clipPath>
            </defs>

            <rect x="66" y="2" width="68" height="19" rx="9.5" fill="var(--jar-lid)" />

            <g clipPath="url(#breaker-jar)">
              <rect x="28" y="20" width="144" height="232" fill="var(--jar-glass)" />

              {game.bricks.map((brick, i) => (
                <rect
                  key={i}
                  ref={(el) => {
                    brickRefs.current[i] = el;
                  }}
                  x={brick.x}
                  y={brick.y}
                  width={brick.w}
                  height={brick.h}
                  rx="3"
                  fill={brick.fill}
                  style={{ transition: 'fill .16s ease' }}
                />
              ))}

              <rect
                ref={paddleRef}
                x={CENTRE_X - PADDLE_W / 2}
                y={PADDLE_Y}
                width={PADDLE_W}
                height={PADDLE_H}
                rx={PADDLE_H / 2}
                fill="var(--who-a)"
              />

              {/*
                The one piece that must never be lost against anything else on
                the field. The wall is drawn in the two people's hues, so the
                ball takes the foreground instead — the strongest mark either
                mode has, and the only one nothing else is using.
              */}
              <circle
                ref={ballRef}
                cx={CENTRE_X}
                cy={PADDLE_Y - BALL_R - 1}
                r={BALL_R}
                fill="var(--foreground)"
              />
            </g>

            <path d={JAR_BODY_PATH} fill="none" stroke="var(--jar-rim)" strokeWidth="3" />
          </svg>
        </div>

        <div
          role="status"
          aria-live="polite"
          aria-busy={phase === 'playing'}
          style={{
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 76,
            width: '100%',
          }}
        >
          {result && (
            <div key={result.key} style={{ width: '100%', maxWidth: 300 }}>
              <Card>
                <Card.Header>
                  <Card.Title>{result.title}</Card.Title>
                  <Card.Description>{result.line}</Card.Description>
                </Card.Header>
              </Card>
            </div>
          )}
        </div>
      </div>

      <div className="sj-footer">
        {/*
          One wrapper and one leading button across all three phases, so React
          updates them in place. Swapping the element at this position unmounts
          whatever holds focus and drops it to <body> — and at the end of a
          round that happens on its own, when the last ball is lost, with no
          action from the player to explain it.
        */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <Button
            size="lg"
            fullWidth
            variant={phase === 'playing' ? 'secondary' : 'primary'}
            onPress={phase === 'playing' ? stop : begin}
          >
            {phase === 'playing' ? 'That’s enough' : phase === 'done' ? 'Go again' : 'Serve the coin'}
          </Button>
          {phase === 'done' && (
            <Button variant="secondary" size="lg" fullWidth onPress={ownUp}>
              Own up and log one
            </Button>
          )}
        </div>
        <p className="text-muted" style={{ fontSize: 12, textAlign: 'center', margin: '10px 0 0' }}>
          Losing costs nothing. The fine is still yours to log.
        </p>
      </div>
    </div>
  );
}

/** Locked until the jar is worth enough — see lib/games/catalogue. */
export default function Page() {
  return (
    <GameGate href="/games/breaker">
      <BreakerPageScreen />
    </GameGate>
  );
}
