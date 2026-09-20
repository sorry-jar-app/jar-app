'use client';

/**
 * Roll — tilt one coin down a course without losing it.
 *
 * The coin is the real jar simulation, not a copy of it: the same step() that
 * settles the pile on the jar screen runs here with a single body in the array.
 * Nothing in this screen moves money. It can end by opening /log with you
 * preselected, which is the same door the jar screen's button opens, and the
 * fine is still a thing you press a button for over there.
 */

import { useCallback, useEffect, useId, useRef, useState, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { GameGate } from '@/components/games/GameGate';
import { ScreenHeader } from '@/components/ScreenHeader';
import { JAR_BODY_PATH } from '@/lib/constants';
import { step, type Coin } from '@/lib/coinTumble';
import { useReducedMotion } from '@/lib/reducedMotion';
import { livesFrom } from '@/lib/games/catalogue';
import { useStore } from '@/lib/store';
import { useTilt } from '@/lib/useTilt';
import { COIN_R, COURSES, START, inTrap, ledges, type Course } from '@/lib/games/roll/courses';

// Slightly under the jar on Who's it, because this screen also carries a
// course row above the play area and can show three buttons below it.
const JAR_W = 196;
const JAR_H = 245;

/** The bottom of the drawing, past the jar's own floor so the clip trims it. */
const FLOOR_BOTTOM = 252;

const CLEARED = [
  'Steady hands. Suspiciously steady.',
  'Down in one piece. Barely counts.',
  'A clean run. The jar is unimpressed.',
  'No drama. Do not get used to it.',
];

const DROPPED = [
  'Straight into the gap. Impressively direct.',
  'Gone. Nobody saw that. Except the jar.',
  'Avoidable, that one. Objectively.',
  'The gap did not move. You did.',
];

const STEER_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

/**
 * How much lean a sensor has to report before it gets to drive.
 *
 * A device that merely HAS an orientation sensor is not a device being tilted.
 * A phone flat on a table, a tablet in a stand and a convertible laptop all
 * fire deviceorientation with beta and gamma at zero, which is a gravity of
 * (0, 0) — the coin never falls, the round never resolves, and handing the
 * sensor exclusive control would take the drag and the arrow keys away on
 * exactly the devices that need them.
 */
const SENSOR_FLOOR = 0.2;

/** A coin that has drifted less than this for REST_FRAMES running has stopped. */
const REST_DRIFT = 0.25;
const REST_FRAMES = 12;

/** Fixed step for the still version, and a ceiling so it always terminates. */
const STILL_DT = 1 / 60;
const STILL_MAX_STEPS = 900;

/**
 * The still version aims with a slider, in hundredths of a lean.
 *
 * Not a row of two or three preset leans: the courses tighten to the point
 * where the third is winnable from roughly one angle, so a handful of presets
 * would hand a reduced-motion player a course they cannot clear at all. A
 * slider is also the honest analogue of the thing it replaces — you are
 * choosing how far to tip the jar — and arrow keys drive a range input for
 * free.
 */
const LEAN_STEP = 5;
const LEAN_MAX = 100;

function leanLabel(lean: number): string {
  if (lean === 0) return 'Straight down';
  return `${lean < 0 ? 'Left' : 'Right'} ${Math.abs(lean)}`;
}

type Phase = 'idle' | 'playing' | 'done';
type Outcome = { won: boolean; course: string; line: string; round: number };

/** Clamp a steering vector to unit length, leaving anything gentler alone. */
function unit(x: number, y: number): { x: number; y: number } {
  const m = Math.hypot(x, y);
  return m > 1 ? { x: x / m, y: y / m } : { x, y };
}

/**
 * The course, drawn. Shared by the animated screen and the still one, which
 * both need the same picture — one of them with a coin that moves.
 */
function CourseView({
  course,
  clipId,
  coinRef,
}: {
  course: Course;
  clipId: string;
  coinRef: RefObject<SVGCircleElement | null>;
}) {
  return (
    <svg
      viewBox="0 0 200 250"
      style={{ width: JAR_W, height: JAR_H, display: 'block' }}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={JAR_BODY_PATH} />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        <rect
          x="28"
          y="20"
          width="144"
          height="232"
          fill="var(--color-accent-100)"
          opacity="0.55"
        />

        {course.traps.map((t) => (
          <rect
            key={`pit-${t.x0}`}
            x={t.x0}
            y={course.goal}
            width={t.x1 - t.x0}
            height={FLOOR_BOTTOM - course.goal}
            fill="var(--color-neutral-800)"
            opacity="0.2"
          />
        ))}

        {ledges(course).map((s) => (
          <rect
            key={`ledge-${s.x0}`}
            x={s.x0}
            y={course.goal}
            width={s.x1 - s.x0}
            height={FLOOR_BOTTOM - course.goal}
            rx="3"
            fill="var(--color-accent-2-500)"
          />
        ))}

        <g>
          {course.pegs.map((p) => (
            <circle
              key={`peg-${p.x}-${p.y}`}
              cx={p.x}
              cy={p.y}
              r={p.r}
              fill="var(--color-neutral-400)"
            />
          ))}
        </g>

        {/* The accent ramp is person A, and A is who owns up at the end. */}
        <circle ref={coinRef} cx={START.x} cy={START.y} r={COIN_R} fill="var(--color-accent-500)" />
      </g>

      <path
        d={JAR_BODY_PATH}
        fill="none"
        stroke="color-mix(in srgb, var(--color-text) 26%, transparent)"
        strokeWidth="3"
      />
    </svg>
  );
}

function RollPageScreen() {
  const router = useRouter();
  const { state, dispatch } = useStore();

  // A coin in the jar is a go. One to begin with, and every fine buys another —
  // so the run you get is the jar you have.
  const allowance = livesFrom(state.coins);
  const reduced = useReducedMotion();
  const clipId = `roll-clip-${useId().replace(/:/g, '')}`;

  const [index, setIndex] = useState(0);
  /**
   * Goes used this run. `left` is derived from it rather than held, so the
   * count follows the jar instead of a figure captured on first render — a
   * fine landing over realtime moves the allowance, and a stored number would
   * quietly disagree with the copy above it.
   *
   * A run costs nothing. Running out ends the run, "Go again" starts another
   * with the full allowance, and no coin is ever spent to buy one: the balls
   * set how long a run lasts, not how many runs there are. The moment a fine
   * is what buys another drop, the screen is asking for money the game just
   * lost, against a ledger two people actually share.
   */
  const [spent, setSpent] = useState(0);
  /** Where the still version's slider is pointing, in hundredths. */
  const [lean, setLean] = useState(0);
  const left = Math.max(0, allowance - spent);
  const [phase, setPhase] = useState<Phase>('idle');
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const course = COURSES[index];
  const hasNext = index < COURSES.length - 1;

  /**
   * The coin first, then the pegs. They are ordinary Coins in one array so the
   * simulation collides them for free; see the loop for how they stay put.
   */
  const bodies = useRef<Coin[]>([]);
  const coinNode = useRef<SVGCircleElement | null>(null);
  const raf = useRef<number | null>(null);
  const round = useRef(0);

  /** Steering from the pointer or the keyboard. Ignored where there is a sensor. */
  const steer = useRef({ x: 0, y: 1 });

  const { gravity: tilt, requestAccess, supported } = useTilt(!reduced);
  const hasSensor = useRef(false);
  hasSensor.current = supported;

  const paint = useCallback(() => {
    const coin = bodies.current[0];
    const node = coinNode.current;
    if (!coin || !node) return;
    node.setAttribute('cx', coin.x.toFixed(2));
    node.setAttribute('cy', coin.y.toFixed(2));
  }, []);

  const seat = useCallback(
    (c: Course) => {
      bodies.current = [
        { x: START.x, y: START.y, vx: 0, vy: 0, r: COIN_R, asleep: false, still: 0 },
        ...c.pegs.map((p) => ({ x: p.x, y: p.y, vx: 0, vy: 0, r: p.r, asleep: true, still: 0 })),
      ];
      paint();
    },
    [paint],
  );

  /** Consecutive frames the coin has barely moved. See the rest rule in run(). */
  const resting = useRef(0);

  const stop = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
  }, []);

  const finish = useCallback(
    (c: Course, won: boolean) => {
      stop();
      const lines = won ? CLEARED : DROPPED;
      // A dropped coin is a go spent. Clearing the course costs nothing.
      if (!won) setSpent((n) => n + 1);
      setOutcome({
        won,
        course: c.name,
        line: lines[Math.floor(Math.random() * lines.length)],
        round: round.current,
      });
      setPhase('done');
    },
    [stop],
  );

  /**
   * One step of the course, shared by the animated loop and the still one.
   *
   * Returns how the round ended, or null to keep going.
   */
  const advance = useCallback(
    (c: Course, gx: number, gy: number, dt: number): 'landed' | 'stopped' | null => {
      const coin = bodies.current[0];
      const wasX = coin.x;
      const wasY = coin.y;

      // coinTumble lets a body fall asleep so a settled pile stops eating the
      // battery. With one coin and a loop that is running anyway, sleep would
      // only mean a tilt going unnoticed, so it never gets to.
      coin.asleep = false;
      coin.still = 0;

      step(bodies.current, dt, gx, gy);

      // The pegs ride along as ordinary coins — that is how they get collision
      // without coinTumble having to learn about static bodies — and step()
      // has just shoved them like everything else. Putting them back here is
      // what makes them pegs. It costs the coin nothing: collidePair splits
      // each overlap in half, so the coin keeps its half every frame and is
      // pushed clear over the next two or three.
      for (let i = 1; i < bodies.current.length; i++) {
        const peg = bodies.current[i];
        const home = c.pegs[i - 1];
        peg.x = home.x;
        peg.y = home.y;
        peg.vx = 0;
        peg.vy = 0;
        peg.asleep = true;
        peg.still = 0;
      }

      if (coin.y + COIN_R >= c.goal) {
        // Snap to rest on the slab. A falling coin covers up to eight units a
        // frame, so the frame that trips the goal can be one that has already
        // buried it past its own centre — and the freeze frame is the whole
        // verdict here.
        coin.y = c.goal - COIN_R;
        return 'landed';
      }

      // Come to rest anywhere else and the round is still over. The jar's
      // bottom corners can park a coin at about y 220, below every peg and
      // short of the goal line, where nothing would ever resolve it — the loop
      // would just run on over a coin sitting still. Not reaching the landing
      // line is a loss.
      if (Math.hypot(coin.x - wasX, coin.y - wasY) < REST_DRIFT) {
        resting.current += 1;
        if (resting.current >= REST_FRAMES) return 'stopped';
      } else {
        resting.current = 0;
      }
      return null;
    },
    [],
  );

  const run = useCallback(
    (c: Course) => {
      if (raf.current !== null) return;
      resting.current = 0;
      let last = performance.now();

      const frame = (now: number) => {
        raf.current = null;
        const dt = (now - last) / 1000;
        last = now;

        const t = tilt.current;
        const g = hasSensor.current && Math.hypot(t.x, t.y) >= SENSOR_FLOOR ? t : steer.current;

        const how = advance(c, g.x, g.y, dt);
        paint();
        if (how) {
          finish(c, how === 'landed' && !inTrap(c, bodies.current[0].x));
          return;
        }

        raf.current = requestAnimationFrame(frame);
      };

      raf.current = requestAnimationFrame(frame);
    },
    [advance, finish, paint, tilt],
  );

  const begin = useCallback(
    (next: number) => {
      // Out of goes starts a fresh run rather than refusing. Nothing is bought
      // and nothing is owed.
      if (left <= 0) setSpent(0);
      stop();
      // iOS hands over orientation only from a real gesture, and this function
      // is only ever reached from one.
      requestAccess();
      steer.current = { x: 0, y: 1 };
      round.current += 1;
      const c = COURSES[next];
      setIndex(next);
      setOutcome(null);
      setPhase('playing');
      seat(c);
      run(c);
    },
    [left, requestAccess, run, seat, stop],
  );

  // A loop left running after the screen has gone is the bug this project has
  // already been bitten by once.
  useEffect(() => stop, [stop]);

  // Seat the coin so there is something to look at before the first tap. Also
  // the recovery path: asking for less motion mid-round pulls the play area out
  // from under the loop, and turning it back off remounts an empty one.
  useEffect(() => {
    stop();
    seat(COURSES[0]);
    setIndex(0);
    setPhase('idle');
    setOutcome(null);
  }, [reduced, seat, stop]);

  useEffect(() => {
    if (phase !== 'playing') return;

    const held = new Set<string>();
    const apply = () => {
      let x = 0;
      // Unlike the pointer, the keyboard starts from straight down and the keys
      // lean it — holding one arrow should tip the jar, not switch gravity off.
      let y = 1;
      if (held.has('ArrowLeft')) x -= 1;
      if (held.has('ArrowRight')) x += 1;
      if (held.has('ArrowUp')) y -= 1.4;
      if (held.has('ArrowDown')) y += 0.6;
      steer.current = unit(x, y);
    };
    const down = (e: KeyboardEvent) => {
      if (!STEER_KEYS.has(e.key)) return;
      e.preventDefault();
      held.add(e.key);
      apply();
    };
    const up = (e: KeyboardEvent) => {
      if (held.delete(e.key)) apply();
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [phase]);

  /** Where the pointer sits relative to the middle of the jar is which way is down. */
  const aim = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    steer.current = unit(
      (e.clientX - (box.left + box.width / 2)) / (box.width / 2),
      (e.clientY - (box.top + box.height / 2)) / (box.height / 2),
    );
  }, []);

  const release = useCallback(() => {
    steer.current = { x: 0, y: 1 };
  }, []);

  const grab = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      aim(e);
    },
    [aim],
  );

  /**
   * The still version of a drop: pick a lean, and the whole run happens at once.
   *
   * The house pattern is to resolve without the movement, not to decline —
   * Who's it? checks the same preference and still picks somebody, it just
   * skips the churn. Roll used to refuse outright, which left the first and
   * only always-open game on the hub as a dead end for anyone who had asked
   * for less motion.
   */
  const dropStill = useCallback(
    (lean: number) => {
      if (left <= 0) setSpent(0);
      const c = COURSES[index];
      round.current += 1;
      setOutcome(null);
      seat(c);
      resting.current = 0;

      const g = unit(lean, 1);
      let how: 'landed' | 'stopped' | null = null;
      for (let i = 0; i < STILL_MAX_STEPS && how === null; i++) {
        how = advance(c, g.x, g.y, STILL_DT);
      }
      paint();
      finish(c, how === 'landed' && !inTrap(c, bodies.current[0].x));
    },
    [advance, finish, index, left, paint, seat],
  );

  function ownUp() {
    // Clear first: a draft abandoned earlier would otherwise arrive at /log with
    // a rule and severity already set, one tap from a fine nobody here chose.
    dispatch({ type: 'draft/reset' });
    dispatch({ type: 'draft/patch', patch: { who: 'A' } });
    router.push('/log');
  }

  // A win with somewhere left to go is the only case where the leading button
  // moves you on rather than repeating the course.
  const movesOn = phase === 'done' && outcome !== null && outcome.won && hasNext;

  let leadLabel: string;
  if (phase === 'playing') leadLabel = 'Start this one over';
  else if (movesOn) leadLabel = 'Next course';
  else if (phase === 'done') leadLabel = left > 0 ? 'Go again' : 'Start a new run';
  else leadLabel = 'Drop the coin';

  // One paragraph, not two. The out-of-goes state used to render its own on top
  // of this one, so the footer said a fine buys another go and then, directly
  // underneath, that nothing here fills the jar.
  let footnote: string;
  if (phase !== 'done') {
    footnote = reduced
      ? 'Land on a bar, not in a gap. The lean is the whole of it.'
      : 'Tilt the phone, drag on the jar, or steer with the arrow keys. Land on a bar, not in a gap.';
  } else if (left <= 0) {
    footnote = `That is the run. ${allowance === 1 ? 'One go' : `All ${allowance} goes`} spent — start another whenever.`;
  } else {
    footnote = 'Owning up opens the usual form. Nothing here fills the jar on its own.';
  }

  if (reduced) {
    return (
      <div className="sj-screen sj-screen--pushed">
        <ScreenHeader title="Roll" backTo="/games" tight />

        <div
          className="sj-body"
          style={{ padding: '4px 24px 14px', gap: 10, alignItems: 'center', textAlign: 'center' }}
        >
          <p className="text-muted" style={{ fontSize: 13, margin: 0, maxWidth: 260 }}>
            Your device asked for less movement, so the coin goes down in one go. Set the lean, then
            drop it.
          </p>

          <div style={{ flex: 'none' }}>
            <CourseView course={course} clipId={clipId} coinRef={coinNode} />
          </div>

          <div
            role="status"
            aria-live="polite"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 74,
              width: '100%',
            }}
          >
            {outcome && (
              // Keyed on the round so losing the same course twice announces twice.
              <div key={outcome.round} className="sj-panel sj-panel--accent" style={{ width: '100%' }}>
                <span className="sj-title" style={{ display: 'block', fontSize: 22 }}>
                  {outcome.won ? 'Down safe' : 'Lost it'}
                </span>
                <span className="text-muted" style={{ fontSize: 13 }}>
                  {outcome.course}. {outcome.line}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="sj-footer">
          <div className="field" style={{ marginBottom: 10 }}>
            <label htmlFor="roll-lean">Lean &mdash; {leanLabel(lean)}</label>
            <input
              id="roll-lean"
              type="range"
              min={-LEAN_MAX}
              max={LEAN_MAX}
              step={LEAN_STEP}
              value={lean}
              onChange={(e) => setLean(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--color-accent-500)' }}
            />
          </div>

          {/* Stable slot: the same leading button in every state, so focus survives. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <button
              type="button"
              className="btn btn-primary btn-block"
              style={{ height: 54, fontSize: 17, marginTop: 0 }}
              onClick={() => dropStill(lean / 100)}
            >
              {phase === 'done' ? 'Drop another' : 'Drop the coin'}
            </button>

            {phase === 'done' && outcome?.won && hasNext && (
              <button
                type="button"
                className="btn btn-secondary btn-block"
                style={{ height: 46, marginTop: 0 }}
                onClick={() => {
                  setIndex(index + 1);
                  setOutcome(null);
                  setPhase('idle');
                  seat(COURSES[index + 1]);
                }}
              >
                Next course
              </button>
            )}

            {phase === 'done' && outcome && (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ alignSelf: 'center', marginTop: 0 }}
                onClick={ownUp}
              >
                {outcome.won ? 'Log one anyway' : 'Own up to it'}
              </button>
            )}
          </div>

          <p className="text-muted" style={{ fontSize: 12, textAlign: 'center', margin: '10px 0 0' }}>
            {footnote}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="sj-screen sj-screen--pushed">
      <ScreenHeader title="Roll" backTo="/games" tight />

      <div
        className="sj-body"
        style={{ padding: '4px 24px 14px', gap: 10, alignItems: 'center', textAlign: 'center' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span className="sj-title" style={{ fontSize: 15 }}>
            {course.name}
          </span>
          <span aria-hidden="true" style={{ display: 'flex', gap: 5 }}>
            {COURSES.map((c, i) => (
              <span
                key={c.name}
                className="sj-dot"
                style={{
                  background:
                    i === index
                      ? 'var(--color-accent-500)'
                      : i < index
                        ? 'var(--color-accent-300)'
                        : 'var(--color-neutral-300)',
                }}
              />
            ))}
          </span>
          <span className="sj-visually-hidden">
            Course {index + 1} of {COURSES.length}. {left} {left === 1 ? 'go' : 'goes'} left.
          </span>
        </div>

        {/* flex: none, or the jar is the thing that gets squashed on a short phone. */}
        <div
          style={{ flex: 'none', touchAction: 'none' }}
          onPointerDown={grab}
          onPointerMove={aim}
          onPointerUp={release}
          onPointerCancel={release}
          onPointerLeave={release}
        >
          <CourseView course={course} clipId={clipId} coinRef={coinNode} />
        </div>

        <div
          role="status"
          aria-live="polite"
          aria-busy={phase === 'playing'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 74,
            width: '100%',
          }}
        >
          {outcome && (
            // Keyed on the round so losing the same course twice announces twice.
            <div key={outcome.round} className="sj-panel sj-panel--accent" style={{ width: '100%' }}>
              <span className="sj-title" style={{ display: 'block', fontSize: 22 }}>
                {outcome.won ? 'Down safe' : 'Lost it'}
              </span>
              <span className="text-muted" style={{ fontSize: 13 }}>
                {outcome.course}. {outcome.line}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="sj-footer">
        {/*
          One wrapper, and one primary button in the leading slot in every
          state, so React updates it in place. Swapping the element here
          unmounts whatever holds focus and drops it to <body> — once a round,
          for a game meant to be fully keyboard-playable.

          Going again always leads. The hand-off to /log is always secondary and
          is never offered as the thing that buys another drop.
        */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <button
            type="button"
            className={
              phase === 'playing' ? 'btn btn-secondary btn-block' : 'btn btn-primary btn-block'
            }
            style={{ height: 54, fontSize: 17, marginTop: 0 }}
            onClick={() => begin(movesOn ? index + 1 : index)}
          >
            {leadLabel}
          </button>

          {phase === 'done' && outcome && (
            <button
              type="button"
              className="btn btn-secondary btn-block"
              style={{ height: 46, marginTop: 0 }}
              onClick={movesOn ? () => begin(index) : outcome.won ? () => begin(0) : ownUp}
            >
              {movesOn ? 'Go again' : outcome.won ? 'Back to the first one' : 'Own up to it'}
            </button>
          )}

          {phase === 'done' && outcome?.won && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ alignSelf: 'center', marginTop: 0 }}
              onClick={ownUp}
            >
              Log one anyway
            </button>
          )}
        </div>
        <p className="text-muted" style={{ fontSize: 12, textAlign: 'center', margin: '10px 0 0' }}>
          {footnote}
        </p>
      </div>
    </div>
  );
}

/** Locked until the jar is worth enough — see lib/games/catalogue. */
export default function Page() {
  return (
    <GameGate href="/games/roll">
      <RollPageScreen />
    </GameGate>
  );
}
