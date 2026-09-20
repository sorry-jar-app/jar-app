'use client';

/**
 * Eight ball — pass the phone, take a shot.
 *
 * Nothing here moves money. A finished rack may hand you to /log with the loser
 * already picked, which is the same path every other screen takes; the jar
 * still only ever fills from a fine somebody chose to log.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/Avatar';
import { GameGate } from '@/components/games/GameGate';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useReducedMotion } from '@/lib/reducedMotion';
import { displayName, initialOf, useStore } from '@/lib/store';
import {
  BALL_R,
  HEAD_Y,
  OPEN_TABLE,
  TABLE,
  VIEW_H,
  VIEW_W,
  judgeShot,
  leftOf,
  newRack,
  other,
  respotCue,
  settle,
  snapshot,
  step,
  strike,
  type Ball,
  type Ending,
  type Group,
  type Groups,
} from '@/lib/games/eightball';
import type { Person } from '@/lib/types';

/** The 200 x 360 table, scaled to something that fits above the footer. */
const TABLE_PX_W = 190;
const TABLE_PX_H = 342;

/** How far one arrow key swings the aim, and how much it moves the power. */
const AIM_STEP = 0.055;
const POWER_STEP = 0.08;
const MIN_POWER = 0.08;

/** A drag this long past the cue ball is full power. */
const POWER_SPAN = 130;
const POWER_DEAD = 10;

const ENDING_LINE: Record<Ending, string> = {
  eight: 'Eight ball last, exactly as agreed.',
  'early-eight': 'The eight went early. That is the whole rule.',
  'scratch-on-eight': 'Cue ball followed the eight in. Same result.',
};

const POTTED_LINES = ['That one counted.', 'Still your table.', 'Go on then.'];
const MISSED_LINES = ['Nothing dropped.', 'Nothing went down.', 'Not a thing.'];
const SCRATCH_LINE = 'Cue ball in a pocket. Back on the spot.';
const OPENING_LINE = 'Open table. The eight goes last.';

const TAU = Math.PI * 2;
const DIRECTIONS = [
  'right',
  'down and right',
  'down the table',
  'down and left',
  'left',
  'up and left',
  'up the table',
  'up and right',
];

function directionOf(angle: number): string {
  const turnsIn = (((angle % TAU) + TAU) % TAU) / (Math.PI / 4);
  return DIRECTIONS[Math.round(turnsIn) % 8];
}

function pick(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}

function groupFill(group: Group): string {
  return group === 'solid' ? 'var(--color-accent-500)' : 'var(--color-accent-2-500)';
}

type Phase = 'aiming' | 'rolling' | 'over';

/** One line of the status region. `head` is what follows the name. */
type Say = { key: number; who: Person; head: string; line: string };

function EightBallScreen() {
  const router = useRouter();
  const { state, dispatch } = useStore();
  const reduced = useReducedMotion();

  // Racked once with a fixed draw rather than a random one: this runs in the
  // static pass and again on the client, and the two have to agree. Every later
  // rack gets a real shuffle, from a handler.
  const ballsRef = useRef<Ball[] | null>(null);
  if (ballsRef.current === null) ballsRef.current = newRack(() => 0.5);
  const balls = ballsRef.current;

  const [rackNo, setRackNo] = useState(0);
  const [phase, setPhase] = useState<Phase>('aiming');
  const [turn, setTurn] = useState<Person>('A');
  const [groups, setGroups] = useState<Groups>(OPEN_TABLE);
  const [winner, setWinner] = useState<Person | null>(null);
  const [say, setSay] = useState<Say>({
    key: 0,
    who: 'A',
    head: 'breaks.',
    line: OPENING_LINE,
  });
  /** Only for the screen reader — the live aim is a ref, painted by hand. */
  const [shownAim, setShownAim] = useState({ angle: -Math.PI / 2, power: 0.55 });

  const svgRef = useRef<SVGSVGElement | null>(null);
  const ballNodes = useRef<(SVGGElement | null)[]>([]);
  const aimLine = useRef<SVGLineElement | null>(null);
  const aimTip = useRef<SVGCircleElement | null>(null);
  const powerBar = useRef<HTMLSpanElement | null>(null);

  const aim = useRef({ angle: -Math.PI / 2, power: 0.55 });
  const beforeShot = useRef<Ball[]>(snapshot(balls));
  const dragging = useRef(false);
  /** A pointer strike also produces a click. One shot per release, not two. */
  const swallowClick = useRef(false);
  const sayNo = useRef(0);

  // Read from the frame loop and from stable callbacks, so changing any of them
  // must not tear the loop down.
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const turnRef = useRef(turn);
  turnRef.current = turn;
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const winnerRef = useRef(winner);
  winnerRef.current = winner;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const aimDescId = useId();

  const paintAim = useCallback(() => {
    const cue = balls[0];
    const live = phaseRef.current === 'aiming' && !cue.potted;
    const { angle, power } = aim.current;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const reach = 26 + power * 94;
    // Starts at the edge of the ball, not its centre, so the dashes do not sit
    // on top of the thing they are pointing away from.
    const x1 = cue.x + dx * (BALL_R + 1.5);
    const y1 = cue.y + dy * (BALL_R + 1.5);
    const x2 = cue.x + dx * reach;
    const y2 = cue.y + dy * reach;

    const line = aimLine.current;
    if (line) {
      line.setAttribute('x1', x1.toFixed(2));
      line.setAttribute('y1', y1.toFixed(2));
      line.setAttribute('x2', x2.toFixed(2));
      line.setAttribute('y2', y2.toFixed(2));
      line.style.opacity = live ? '0.8' : '0';
    }

    const tip = aimTip.current;
    if (tip) {
      tip.setAttribute('cx', x2.toFixed(2));
      tip.setAttribute('cy', y2.toFixed(2));
      tip.style.opacity = live ? '0.8' : '0';
    }

    if (powerBar.current) powerBar.current.style.width = `${Math.round(power * 100)}%`;
  }, [balls]);

  const paint = useCallback(() => {
    for (let i = 0; i < balls.length; i++) {
      const node = ballNodes.current[i];
      if (!node) continue;
      const ball = balls[i];
      node.setAttribute('transform', `translate(${ball.x.toFixed(2)} ${ball.y.toFixed(2)})`);
      node.style.display = ball.potted ? 'none' : '';
    }
    paintAim();
  }, [balls, paintAim]);

  useEffect(() => {
    paint();
  }, [paint, rackNo, phase]);

  /** Read the shot that has just finished rolling, and say what happened. */
  const readShot = useCallback(() => {
    const shooter = turnRef.current;
    const outcome = judgeShot(shooter, groupsRef.current, beforeShot.current, balls);
    if (outcome.scratched) respotCue(balls, TABLE);

    groupsRef.current = outcome.groups;
    setGroups(outcome.groups);
    sayNo.current += 1;

    if (outcome.winner) {
      winnerRef.current = outcome.winner;
      setWinner(outcome.winner);
      setPhase('over');
      setSay({
        key: sayNo.current,
        who: outcome.winner,
        head: 'takes it.',
        line: ENDING_LINE[outcome.ending ?? 'eight'],
      });
    } else {
      turnRef.current = outcome.next;
      setTurn(outcome.next);
      setPhase('aiming');
      setSay({
        key: sayNo.current,
        who: outcome.next,
        head: outcome.again ? 'again.' : 'to play.',
        line: outcome.scratched
          ? SCRATCH_LINE
          : outcome.again
            ? pick(POTTED_LINES)
            : pick(MISSED_LINES),
      });
    }

    aim.current = { angle: aim.current.angle, power: 0.55 };
    setShownAim(aim.current);
    paint();
  }, [balls, paint]);

  useEffect(() => {
    if (phase !== 'rolling') return;

    let raf = requestAnimationFrame(frame);
    let last = performance.now();

    function frame(now: number) {
      const dt = (now - last) / 1000;
      last = now;
      const moving = step(balls, TABLE, dt);
      paint();
      if (moving) {
        raf = requestAnimationFrame(frame);
        return;
      }
      readShot();
    }

    // Covers leaving the screen mid-shot as well as the shot ending: a loop
    // left running after the screen has gone is a bug this project has already
    // been bitten by.
    return () => cancelAnimationFrame(raf);
  }, [phase, balls, paint, readShot]);

  const fire = useCallback(() => {
    if (phaseRef.current !== 'aiming') return;
    if (balls[0].potted) return;

    beforeShot.current = snapshot(balls);
    strike(balls, aim.current.angle, aim.current.power);

    if (reducedRef.current) {
      // No animation was asked for, so there is none: the shot resolves and the
      // table shows where everything came to rest.
      settle(balls, TABLE);
      paint();
      readShot();
      return;
    }
    setPhase('rolling');
  }, [balls, paint, readShot]);

  const aimAt = useCallback(
    (clientX: number, clientY: number) => {
      const box = svgRef.current?.getBoundingClientRect();
      if (!box || box.width === 0) return;
      const cue = balls[0];
      const dx = ((clientX - box.left) / box.width) * VIEW_W - cue.x;
      const dy = ((clientY - box.top) / box.height) * VIEW_H - cue.y;
      const reach = Math.hypot(dx, dy);
      // Right on top of the cue ball there is no direction to read, so the last
      // one stands and only the power falls away.
      const angle = reach > 4 ? Math.atan2(dy, dx) : aim.current.angle;
      const power = Math.min(1, Math.max(MIN_POWER, (reach - POWER_DEAD) / POWER_SPAN));
      aim.current = { angle, power };
      paintAim();
    },
    [balls, paintAim],
  );

  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    swallowClick.current = false;
    if (phase !== 'aiming') return;
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    aimAt(event.clientX, event.clientY);
  }

  function onPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (dragging.current) aimAt(event.clientX, event.clientY);
  }

  function onPointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging.current) return;
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setShownAim(aim.current);
    swallowClick.current = true;
    fire();
  }

  function onPointerCancel(event: React.PointerEvent<HTMLButtonElement>) {
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    paintAim();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === ' ' || event.key === 'Enter') {
      // The button's own activation fires the shot; only make sure a release
      // somewhere else has not left the guard up.
      swallowClick.current = false;
      return;
    }
    if (phase !== 'aiming') return;

    let { angle, power } = aim.current;
    if (event.key === 'ArrowLeft') angle -= AIM_STEP;
    else if (event.key === 'ArrowRight') angle += AIM_STEP;
    else if (event.key === 'ArrowUp') power = Math.min(1, power + POWER_STEP);
    else if (event.key === 'ArrowDown') power = Math.max(MIN_POWER, power - POWER_STEP);
    else return;

    event.preventDefault();
    aim.current = { angle, power };
    setShownAim(aim.current);
    paintAim();
  }

  function onTableClick() {
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
    fire();
  }

  const rackUp = useCallback(() => {
    const fresh = newRack();
    // Filled in place so the SVG groups keep their refs and their identity.
    for (let i = 0; i < balls.length; i++) Object.assign(balls[i], fresh[i]);

    const breaks: Person = winnerRef.current ? other(winnerRef.current) : 'A';
    groupsRef.current = OPEN_TABLE;
    setGroups(OPEN_TABLE);
    winnerRef.current = null;
    setWinner(null);
    turnRef.current = breaks;
    setTurn(breaks);
    aim.current = { angle: -Math.PI / 2, power: 0.55 };
    setShownAim(aim.current);
    sayNo.current += 1;
    setSay({ key: sayNo.current, who: breaks, head: 'breaks.', line: OPENING_LINE });
    setPhase('aiming');
    setRackNo((n) => n + 1);
  }, [balls]);

  // A real jar is solo until the second person joins, and the database refuses
  // a fine on someone who is not in it. Offering it and then swallowing it is
  // worse than not offering it.
  const soloJar = Boolean(state.jar && !state.jar.partnerId);
  const loser = winner ? other(winner) : null;
  const fineWho: Person = soloJar ? 'A' : (loser ?? 'A');

  function logIt() {
    // Clear first: a draft abandoned earlier would otherwise arrive at /log with
    // a rule and severity already set, one tap from a fine nobody here chose.
    dispatch({ type: 'draft/reset' });
    dispatch({ type: 'draft/patch', patch: { who: fineWho } });
    router.push('/log');
  }

  const sayName = displayName(state, say.who);
  const shooterGroup = groups[say.who];
  const solidsLeft = leftOf(balls, 'solid');
  const stripesLeft = leftOf(balls, 'stripe');
  const shooterLeft = shooterGroup === null ? 0 : leftOf(balls, shooterGroup);
  const onTheEight = shooterGroup !== null && shooterLeft === 0;
  const standing =
    shooterGroup === null
      ? 'Open table.'
      : onTheEight
        ? 'On the eight.'
        : `${shooterGroup === 'solid' ? 'Solids' : 'Stripes'}, ${shooterLeft} left.`;
  // The table is decorative to a screen reader, so the status region has to
  // carry the position as well as the commentary.
  const spokenStanding =
    shooterGroup === null
      ? 'Open table.'
      : onTheEight
        ? 'On the eight.'
        : `On ${shooterGroup === 'solid' ? 'solids' : 'stripes'}.`;

  return (
    <div className="sj-screen sj-screen--pushed">
      <ScreenHeader title="Eight ball" backTo="/games" tight />

      <div
        className="sj-body"
        style={{ padding: '4px 24px 14px', gap: 10, alignItems: 'center', textAlign: 'center' }}
      >
        <p className="text-muted" style={{ fontSize: 13, margin: 0, maxWidth: 270 }}>
          Drag to aim and let go to shoot, or use the arrow keys. The first ball you pot is your
          group; the eight goes last.
        </p>

        {/* flex: none, or the table is the thing that gets squashed on a short phone. */}
        <div style={{ flex: 'none' }}>
          <button
            type="button"
            className="sj-jar-tap"
            style={{ touchAction: 'none', borderRadius: 20 }}
            aria-label="Aim and shoot. Left and right arrows aim, up and down set the power, space shoots."
            aria-describedby={aimDescId}
            // aria-disabled rather than disabled: a disabled button drops focus the
            // moment a shot starts, and a keyboard player would have to tab back to
            // the table after every turn. Every handler already guards on the phase.
            aria-disabled={phase !== 'aiming'}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onKeyDown={onKeyDown}
            onClick={onTableClick}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              style={{ width: TABLE_PX_W, height: TABLE_PX_H, display: 'block' }}
              aria-hidden="true"
            >
              <rect
                x="0"
                y="0"
                width={VIEW_W}
                height={VIEW_H}
                rx="18"
                fill="var(--color-accent-700)"
              />
              <rect
                x={TABLE.left}
                y={TABLE.top}
                width={TABLE.right - TABLE.left}
                height={TABLE.bottom - TABLE.top}
                rx={TABLE.corner}
                fill="var(--color-accent-2-100)"
              />
              <line
                x1={TABLE.left}
                y1={HEAD_Y}
                x2={TABLE.right}
                y2={HEAD_Y}
                stroke="var(--color-accent-2-300)"
                strokeWidth="0.8"
              />

              {TABLE.pockets.map((pocket, i) => (
                <circle
                  key={i}
                  cx={pocket.x}
                  cy={pocket.y}
                  r={pocket.r}
                  fill="var(--color-accent-900)"
                />
              ))}

              <line
                ref={aimLine}
                x1={0}
                y1={0}
                x2={0}
                y2={0}
                stroke="var(--color-accent-600)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeDasharray="3 6"
                style={{ opacity: 0 }}
              />
              <circle
                ref={aimTip}
                cx={0}
                cy={0}
                r={2.4}
                fill="var(--color-accent-600)"
                style={{ opacity: 0 }}
              />

              {balls.map((ball, i) => (
                <g
                  key={i}
                  ref={(el) => {
                    ballNodes.current[i] = el;
                  }}
                  transform={`translate(${ball.x} ${ball.y})`}
                >
                  {ball.kind === 'cue' && (
                    <circle
                      r={BALL_R}
                      fill="var(--color-bg)"
                      stroke="color-mix(in srgb, var(--color-text) 45%, transparent)"
                      strokeWidth="1"
                    />
                  )}
                  {ball.kind === 'eight' && <circle r={BALL_R} fill="var(--color-text)" />}
                  {ball.kind === 'solid' && (
                    <circle
                      r={BALL_R}
                      fill="var(--color-accent-500)"
                      stroke="var(--color-accent-700)"
                      strokeWidth="0.7"
                    />
                  )}
                  {ball.kind === 'stripe' && (
                    <>
                      <circle
                        r={BALL_R}
                        fill="var(--color-accent-2-300)"
                        stroke="var(--color-accent-2-700)"
                        strokeWidth="0.7"
                      />
                      <rect
                        x={-6.2}
                        y={-2.4}
                        width={12.4}
                        height={4.8}
                        rx={1.2}
                        fill="var(--color-accent-2-700)"
                      />
                    </>
                  )}
                </g>
              ))}
            </svg>
          </button>
        </div>

        <span id={aimDescId} className="sj-visually-hidden">
          Aim {directionOf(shownAim.angle)}. Power {Math.round(shownAim.power * 100)} per cent.
        </span>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            maxWidth: TABLE_PX_W,
          }}
        >
          <span className="text-muted" style={{ fontSize: 12, flex: 'none' }}>
            Power
          </span>
          <span aria-hidden="true" className="sj-bar-track" style={{ flex: 1 }}>
            <span
              ref={powerBar}
              style={{
                display: 'block',
                height: '100%',
                width: '55%',
                borderRadius: 999,
                background: 'var(--color-accent-500)',
              }}
            />
          </span>
        </div>

        <div
          role="status"
          aria-live="polite"
          aria-busy={phase === 'rolling'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 96,
            width: '100%',
          }}
        >
          <div
            key={say.key}
            className="sj-panel sj-panel--accent"
            style={{ display: 'flex', alignItems: 'center', gap: 12 }}
          >
            <Avatar person={say.who} initial={initialOf(sayName)} size={34} />
            <span style={{ textAlign: 'left' }}>
              <span className="sj-title" style={{ display: 'block', fontSize: 19 }}>
                {sayName} {say.head}
              </span>
              <span className="text-muted" style={{ fontSize: 13 }}>
                {say.line}
              </span>
              {phase !== 'over' && (
                <span
                  style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}
                  aria-hidden="true"
                >
                  {shooterGroup && (
                    <span
                      className="sj-dot"
                      style={{ width: 8, height: 8, background: groupFill(shooterGroup) }}
                    />
                  )}
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    {standing}
                  </span>
                </span>
              )}
              {phase !== 'over' && (
                <span className="sj-visually-hidden">
                  {' '}
                  {spokenStanding} {solidsLeft} solids and {stripesLeft} stripes left on the table.
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="sj-footer">
        {/*
          One wrapper and one leading button in every phase, so React updates
          them in place. Swapping the element at this position unmounts whatever
          holds focus and drops it to <body> — and the rack ends on its own, on
          the last ball, with no action from the player to explain it.
        */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <button
            type="button"
            className="btn btn-primary btn-block"
            style={{ height: 54, fontSize: 17, marginTop: 0 }}
            aria-busy={phase === 'rolling'}
            disabled={phase === 'rolling'}
            onClick={phase === 'over' ? rackUp : fire}
          >
            {phase === 'over' ? 'Rack them up' : phase === 'rolling' ? 'Rolling…' : 'Take the shot'}
          </button>
          {phase === 'over' && (
            <button
              type="button"
              className="btn btn-secondary btn-block"
              style={{ height: 46, marginTop: 0 }}
              onClick={logIt}
            >
              {soloJar ? 'Own up and log one' : `Log a fine on ${displayName(state, fineWho)}`}
            </button>
          )}
        </div>
        <p className="text-muted" style={{ fontSize: 12, textAlign: 'center', margin: '10px 0 0' }}>
          Nobody owes anything for this. The fine is still yours to log.
        </p>
      </div>
    </div>
  );
}

/** Locked until the jar is worth enough — see lib/games/catalogue. */
export default function Page() {
  return (
    <GameGate href="/games/eightball">
      <EightBallScreen />
    </GameGate>
  );
}
