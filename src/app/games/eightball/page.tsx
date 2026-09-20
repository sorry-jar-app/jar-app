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
import { Button, Card } from '@heroui/react';
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
// Not "Open table." — the standing line directly under this already says so,
// and on the opening frame the card read "Open table. The eight goes last."
// with "Open table." repeated beneath it.
const OPENING_LINE = 'The eight goes last.';

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

/**
 * What a ball is painted with. The table and the status dot both read this, so
 * the dot beside "Stripes, 4 left." cannot drift away from the stripes on the
 * cloth — which it had, to a darker, more saturated sage than anything in play.
 *
 * `body` is the disc, `band` is the ring around it — and on a stripe, the band
 * across its face as well, which is the one thing that tells the two groups
 * apart at seven units across. The two hues are the artwork's own: the same
 * pair the avatars, the jar and the split bar use, so a group reads as a
 * person's colour rather than as a colour this screen made up.
 */
const BALL_FILL = {
  solid: { body: 'var(--who-a)', band: 'var(--jar-rim)' },
  stripe: { body: 'var(--who-s)', band: 'var(--background)' },
} as const;

function groupFill(group: Group): string {
  return BALL_FILL[group].body;
}

/**
 * The shooter's own colour, for the power meter under the table.
 *
 * The person, not their group: the meter sits directly under the avatar in the
 * status card and belongs to whoever is about to shoot. Which group they are
 * on is said in words, with the dot beside it.
 */
function personFill(who: Person): string {
  return who === 'A' ? 'var(--who-a)' : 'var(--who-s)';
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
  /**
   * The aim, announced.
   *
   * aria-describedby is read when the control takes focus, not when its text
   * changes, so arrowing the cue eleven times to the right said nothing at all
   * — and the dotted line and the power bar are the only other channel, both of
   * them visual. Separate from `shownAim` so it only speaks for the keyboard,
   * and debounced so a held arrow does not flood the queue.
   */
  const [spokenAim, setSpokenAim] = useState('');
  const aimByKey = useRef(false);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const ballNodes = useRef<(SVGGElement | null)[]>([]);
  const aimLine = useRef<SVGLineElement | null>(null);
  const aimTip = useRef<SVGCircleElement | null>(null);
  const powerBar = useRef<HTMLSpanElement | null>(null);

  const aim = useRef({ angle: -Math.PI / 2, power: 0.55 });
  const beforeShot = useRef<Ball[]>(snapshot(balls));
  const dragging = useRef(false);
  /** Held for the length of a shot, animated or not. See fire(). */
  const firing = useRef(false);
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

  // Speaks only for the keyboard, and only once the arrows have stopped — a
  // shot resolving also moves shownAim, and that must not talk over the result.
  useEffect(() => {
    if (!aimByKey.current) return;
    const t = setTimeout(() => {
      aimByKey.current = false;
      setSpokenAim(
        `Aim ${directionOf(shownAim.angle)}. Power ${Math.round(shownAim.power * 100)} per cent.`,
      );
    }, 300);
    return () => clearTimeout(t);
  }, [shownAim]);

  /**
   * Reshuffle once the client is live.
   *
   * The rack above is drawn with a fixed 0.5 so the static pass and the first
   * client pass agree — but nothing ever re-rolled it, so the opening rack was
   * byte-identical on every visit and for every player. With rand pinned at
   * 0.5 even `solidLeft` never flipped. Filled in place, the way rackUp does
   * it, so the SVG groups keep their refs.
   */
  useEffect(() => {
    const fresh = newRack();
    for (let i = 0; i < balls.length; i++) Object.assign(balls[i], fresh[i]);
    // Bumping the rack is not cosmetic here. paint() writes transforms and
    // nothing else, but which ball is a solid and which a stripe is decided in
    // the render — so shuffling the array in place without a re-render leaves
    // the cloth showing the old rack while the rules go by the new one. rackUp
    // bumps it for exactly this reason.
    setRackNo((n) => n + 1);
    paint();
    // Once, on mount. A reshuffle mid-rack would move the balls under the player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Read the shot that has just finished rolling, and say what happened. */
  const readShot = useCallback(() => {
    const shooter = turnRef.current;
    const outcome = judgeShot(shooter, groupsRef.current, beforeShot.current, balls);
    // Only when there is a next shot to take. Scratching on the eight sets both
    // flags, and respotting there put the cue calmly back on the head spot
    // under a line explaining that it had followed the eight in.
    if (outcome.scratched && !outcome.winner) respotCue(balls, TABLE);

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
      firing.current = false;
    }

    // Covers leaving the screen mid-shot as well as the shot ending: a loop
    // left running after the screen has gone is a bug this project has already
    // been bitten by.
    return () => cancelAnimationFrame(raf);
  }, [phase, balls, paint, readShot]);

  const fire = useCallback(() => {
    if (phaseRef.current !== 'aiming') return;
    if (balls[0].potted) return;
    // Spans the whole resolution, which the phase does not.
    //
    // Under reduced motion the shot settles synchronously and readShot hands
    // the phase straight back to 'aiming' for the next player — so the phase
    // guard above is already satisfied again by the time the second activation
    // of the same press arrives. Holding Enter on the footer button, which
    // browsers auto-repeat, played out the whole rack by itself, alternating
    // turns and reusing the previous player's aim; a double tap did it once.
    if (firing.current) return;
    firing.current = true;

    beforeShot.current = snapshot(balls);
    strike(balls, aim.current.angle, aim.current.power);

    if (reducedRef.current) {
      // No animation was asked for, so there is none: the shot resolves and the
      // table shows where everything came to rest.
      settle(balls, TABLE);
      paint();
      readShot();
      firing.current = false;
      return;
    }
    setPhase('rolling');
  }, [balls, paint, readShot]);

  const aimAt = useCallback(
    (clientX: number, clientY: number) => {
      // Measured on the live element every time, never cached: the table is a
      // different size on every screen now, and it changes again whenever the
      // status card under it grows a line.
      const box = svgRef.current?.getBoundingClientRect();
      if (!box || box.width === 0 || box.height === 0) return;
      const cue = balls[0];
      // The drawing is centred and letterboxed inside its box whenever the
      // box's ratio is not the viewBox's, so the pointer goes through the same
      // scale the SVG used. Stretching it across the whole element would put
      // the aim a few units off the finger the moment the two disagree.
      const scale = Math.min(box.width / VIEW_W, box.height / VIEW_H);
      const inX = (clientX - box.left - (box.width - VIEW_W * scale) / 2) / scale;
      const inY = (clientY - box.top - (box.height - VIEW_H * scale) / 2) / scale;
      const dx = inX - cue.x;
      const dy = inY - cue.y;
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
    aimByKey.current = true;
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
    firing.current = false;
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
        {/* flex: none on everything around the field: the board is the one
            thing that gives and takes the leftover height. */}
        <p className="text-muted" style={{ fontSize: 13, margin: 0, maxWidth: 270, flex: 'none' }}>
          Drag to aim and let go to shoot, or use the arrow keys. The first ball you pot is your
          group; the eight goes last.
        </p>

        {/*
          The board is the screen.

          .sj-field takes everything left between the line above and the
          footer and sizes the drawing off its own viewBox, which is how a
          200 x 360 table stops being 190px wide on a 390px phone with a
          screenful of nothing under it. The classes sit on the tap target
          itself rather than on a wrapper, because .sj-field sizes its direct
          svg child — and it is declared after .sj-jar-tap, so the grid and the
          touch-action are the ones that land.
        */}
        <button
          type="button"
          className="sj-jar-tap sj-field sj-field--tall"
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
          {/* The viewBox is the physics module's own coordinate system. Only
              the CSS box around it changes. */}
          <svg ref={svgRef} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} aria-hidden="true">
            {/* The rails, then the cloth. Both are translucent: the gradient
                behind the app shows through the table the way it shows
                through the jar, and the rim is what gives it its edge. Inset
                by a unit so the outline is not half-clipped by the viewBox. */}
            <rect
              x="1"
              y="1"
              width={VIEW_W - 2}
              height={VIEW_H - 2}
              rx="18"
              fill="var(--jar-glass)"
              stroke="var(--jar-rim)"
              strokeWidth="1.5"
            />
            <rect
              x={TABLE.left}
              y={TABLE.top}
              width={TABLE.right - TABLE.left}
              height={TABLE.bottom - TABLE.top}
              rx={TABLE.corner}
              fill="var(--field-wash)"
              stroke="var(--jar-rim)"
              strokeWidth="1"
            />
            <line
              x1={TABLE.left}
              y1={HEAD_Y}
              x2={TABLE.right}
              y2={HEAD_Y}
              stroke="var(--piece-dead)"
              strokeWidth="0.8"
            />

            {TABLE.pockets.map((pocket, i) => (
              <circle key={i} cx={pocket.x} cy={pocket.y} r={pocket.r} fill="var(--field-ink)" />
            ))}

            <line
              ref={aimLine}
              x1={0}
              y1={0}
              x2={0}
              y2={0}
              stroke="var(--field-ink)"
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
              fill="var(--field-ink)"
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
                {/* The cue is the page colour with an ink rim, the eight is
                    solid ink — hollow against filled, which is what keeps the
                    two apart once dark mode has swapped which of them is the
                    pale one. The rim is full strength rather than the 45% the
                    old one had: at 45% in dark mode the cue read like a
                    seventh pocket. */}
                {ball.kind === 'cue' && (
                  <circle
                    r={BALL_R}
                    fill="var(--background)"
                    stroke="var(--foreground)"
                    strokeWidth="1"
                  />
                )}
                {ball.kind === 'eight' && <circle r={BALL_R} fill="var(--foreground)" />}
                {ball.kind === 'solid' && (
                  <circle
                    r={BALL_R}
                    fill={BALL_FILL.solid.body}
                    stroke={BALL_FILL.solid.band}
                    strokeWidth="0.7"
                  />
                )}
                {ball.kind === 'stripe' && (
                  <>
                    <circle
                      r={BALL_R}
                      fill={BALL_FILL.stripe.body}
                      stroke={BALL_FILL.stripe.band}
                      strokeWidth="0.7"
                    />
                    <rect
                      x={-6.2}
                      y={-2.4}
                      width={12.4}
                      height={4.8}
                      rx={1.2}
                      fill={BALL_FILL.stripe.band}
                    />
                  </>
                )}
              </g>
            ))}
          </svg>
        </button>

        <span id={aimDescId} className="sj-visually-hidden">
          Aim {directionOf(shownAim.angle)}. Power {Math.round(shownAim.power * 100)} per cent.
        </span>
        <span role="status" aria-live="polite" className="sj-visually-hidden">
          {spokenAim}
        </span>

        {/*
          Artwork rather than a Meter: the fill is written straight to the node
          by paintAim on every pointer move, sixty times a second, and the aim
          is announced as text — so this is aria-hidden and the kit has nothing
          to add. The track spans the screen now that the table is not pinned
          to a width to line up with.
        */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', flex: 'none' }}
        >
          <span aria-hidden="true" className="text-muted" style={{ fontSize: 12, flex: 'none' }}>
            Power
          </span>
          <span
            aria-hidden="true"
            style={{
              flex: 1,
              height: 6,
              borderRadius: 999,
              background: 'var(--piece-dead)',
              overflow: 'hidden',
            }}
          >
            <span
              ref={powerBar}
              style={{
                display: 'block',
                height: '100%',
                width: '55%',
                borderRadius: 999,
                background: personFill(turn),
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
            flex: 'none',
          }}
        >
          {/* Keyed so a new line remounts the card and the live region speaks
              even when two turns running say the same thing. */}
          <Card key={say.key} style={{ width: '100%' }}>
            <Card.Content style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
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
                        style={{
                          flex: 'none',
                          display: 'block',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: groupFill(shooterGroup),
                        }}
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
                    {spokenStanding} {solidsLeft} solids and {stripesLeft} stripes left on the
                    table.
                  </span>
                )}
              </span>
            </Card.Content>
          </Card>
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
          {/*
            aria-disabled, not isDisabled, for the same reason the table button
            gives: a real `disabled` drops focus the moment a shot starts, and
            this is the control a keyboard player uses every turn. fire()
            refuses on the phase and on the firing latch, so a press while
            rolling is a no-op.

            Both attributes have to come back through `render`: HeroUI's Button
            filters everything but the labelling aria-* props off, and sets
            aria-disabled itself from its own pending state.
          */}
          <Button
            size="lg"
            fullWidth
            render={(props) => (
              <button
                {...props}
                aria-busy={phase === 'rolling'}
                aria-disabled={phase === 'rolling' || undefined}
              />
            )}
            onPress={phase === 'over' ? rackUp : fire}
          >
            {phase === 'over' ? 'Rack them up' : phase === 'rolling' ? 'Rolling…' : 'Take the shot'}
          </Button>
          {phase === 'over' && (
            <Button variant="secondary" size="lg" fullWidth onPress={logIt}>
              {soloJar ? 'Own up and log one' : `Log a fine on ${displayName(state, fineWho)}`}
            </Button>
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
