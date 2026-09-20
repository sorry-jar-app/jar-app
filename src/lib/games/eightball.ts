/**
 * Eight ball — the table, the balls, and the rules that judge a shot.
 *
 * A sibling of coinTumble rather than a change to it. The jar is a settling
 * simulation: gravity pulls everything down, coins pile up and fall asleep.
 * Pool is the same circles with none of that — no gravity, friction instead of
 * damping, and collisions that trade almost all of their energy rather than
 * swallowing it. What is worth borrowing is the shape of the maths: the corner
 * arc in `cushion` and the impulse exchange in `collidePair` are coinTumble's,
 * retuned.
 *
 * The one thing this file must never do is lose a ball. A cue ball at full
 * power covers more than a ball's width in a single 60fps frame, so a naive
 * integration steps straight over a cushion or another ball and the ball is
 * gone — silently, mid-game, with no error to notice. Two things prevent it:
 * `step` sub-divides the frame so nothing travels further than `MAX_ADVANCE`,
 * and `cushion` is a projection rather than a sweep, so whatever a ball's
 * position is, it is put back on the inside of the boundary.
 *
 * Coordinates are a fixed 200 x 360 box, the way the jar is a fixed 200 x 250
 * one, so the screen scales it and nothing here has to know about pixels.
 */

import type { Person } from '@/lib/types';

export type BallKind = 'cue' | 'solid' | 'stripe' | 'eight';

export type Ball = {
  /** Stable for the life of a rack, so a before/after pair can be compared. */
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  kind: BallKind;
  /** Down a pocket: out of play, and skipped by every loop in here. */
  potted: boolean;
};

export type Pocket = { x: number; y: number; r: number };

export type Table = {
  /** The whole drawing, cushions included — the SVG viewBox. */
  w: number;
  h: number;
  /** The playing surface, inside the cushions. */
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Corner arc radius of the playing surface. */
  corner: number;
  pockets: Pocket[];
};

export const VIEW_W = 200;
export const VIEW_H = 360;

export const BALL_R = 7;

const LEFT = 18;
const RIGHT = 182;
const TOP = 18;
const BOTTOM = 342;
const CORNER = 13;

/**
 * Pocket mouths, and why the corner ones sit inside the corner.
 *
 * A ball is potted when its centre comes within the pocket radius. Put a corner
 * pocket exactly on the corner and the arc holds the ball 12.4 units away at
 * its closest — further than the mouth — so the corners would never take a
 * ball at all. Seven units in along the diagonal is the mouth of the pocket
 * rather than the point behind it, which is both what a real table looks like
 * and what makes the corners pottable.
 */
const POCKET_R = 11;
const POCKET_INSET = 7;

export const CENTRE_X = (LEFT + RIGHT) / 2;
/** Where the cue ball is racked and respotted. */
export const HEAD_Y = 265;

export const TABLE: Table = {
  w: VIEW_W,
  h: VIEW_H,
  left: LEFT,
  right: RIGHT,
  top: TOP,
  bottom: BOTTOM,
  corner: CORNER,
  pockets: [
    { x: LEFT + POCKET_INSET, y: TOP + POCKET_INSET, r: POCKET_R },
    { x: RIGHT - POCKET_INSET, y: TOP + POCKET_INSET, r: POCKET_R },
    { x: LEFT + POCKET_INSET, y: BOTTOM - POCKET_INSET, r: POCKET_R },
    { x: RIGHT - POCKET_INSET, y: BOTTOM - POCKET_INSET, r: POCKET_R },
    { x: LEFT, y: (TOP + BOTTOM) / 2, r: POCKET_R },
    { x: RIGHT, y: (TOP + BOTTOM) / 2, r: POCKET_R },
  ],
};

/* ── the rack ────────────────────────────────────────────────────────────── */

/**
 * Centre to centre in the triangle: a hair over 2r, so nothing starts
 * overlapping but the rack is as tight as a real one. The gap matters more
 * than it looks — leave a unit of air between the rows and the break dies in
 * the front two, because each ball has to cross the gap before it passes the
 * hit on.
 */
const SPACING = 14.1;
const ROW_H = SPACING * Math.sin(Math.PI / 3);
/** The apex ball, nearest the cue — the triangle opens away from it. */
const APEX_Y = 110;

/** The two things a real rack fixes: the eight in the middle, one of each at the back. */
const EIGHT_SLOT = 4;
const BACK_LEFT = 10;
const BACK_RIGHT = 14;

/* ── motion ──────────────────────────────────────────────────────────────── */

/** Same clamp as coinTumble: a backgrounded tab hands back a huge delta. */
const MAX_DT = 1 / 30;

/**
 * The furthest any ball may travel between collision checks. Well under the
 * ball radius, so two balls closing head-on still overlap for several
 * sub-steps before they could pass through each other.
 */
const MAX_ADVANCE = 2.5;
const MAX_SUBS = 24;

/**
 * Cloth friction, as a flat deceleration — which is how a rolling ball actually
 * behaves. Tuned against the table rather than reality: a full-power break has
 * to spread the rack and still be over in under two seconds, because the other
 * person is holding out their hand for the phone.
 */
const DECEL = 150;
/** Below this a ball is stopped outright, so the table actually comes to rest. */
const STOP_SPEED = 8;

const CUSHION_RESTITUTION = 0.74;
const CUSHION_FRICTION = 0.92;
/** Near elastic, equal mass. Pool balls barely lose anything to each other. */
const BALL_RESTITUTION = 0.96;

/** The slowest and fastest a struck cue ball leaves the tip. */
export const MIN_SHOT = 170;
export const MAX_SHOT = 700;

/* ── building a rack ─────────────────────────────────────────────────────── */

function shuffle<T>(items: T[], rand: () => number): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const held = items[i];
    items[i] = items[j];
    items[j] = held;
  }
}

/**
 * A cue ball and a triangle, deterministic for a given `rand`.
 *
 * Index 0 is always the cue ball; the rest are the triangle from the apex
 * outward. Both the screen and the tests lean on that order.
 */
export function newRack(rand: () => number = Math.random): Ball[] {
  const kinds: BallKind[] = [];
  for (let i = 0; i < 15; i++) kinds.push('solid');

  kinds[EIGHT_SLOT] = 'eight';
  const solidLeft = rand() < 0.5;
  kinds[BACK_LEFT] = solidLeft ? 'solid' : 'stripe';
  kinds[BACK_RIGHT] = solidLeft ? 'stripe' : 'solid';

  const rest: BallKind[] = [];
  for (let i = 0; i < 6; i++) rest.push('solid');
  for (let i = 0; i < 6; i++) rest.push('stripe');
  shuffle(rest, rand);

  let taken = 0;
  for (let slot = 0; slot < 15; slot++) {
    if (slot === EIGHT_SLOT || slot === BACK_LEFT || slot === BACK_RIGHT) continue;
    kinds[slot] = rest[taken++];
  }

  const balls: Ball[] = [
    { id: 0, x: CENTRE_X, y: HEAD_Y, vx: 0, vy: 0, r: BALL_R, kind: 'cue', potted: false },
  ];

  let slot = 0;
  for (let row = 0; row <= 4; row++) {
    for (let i = 0; i <= row; i++) {
      balls.push({
        id: slot + 1,
        x: CENTRE_X + (i - row / 2) * SPACING,
        y: APEX_Y - row * ROW_H,
        vx: 0,
        vy: 0,
        r: BALL_R,
        kind: kinds[slot],
        potted: false,
      });
      slot++;
    }
  }

  return balls;
}

export function snapshot(balls: readonly Ball[]): Ball[] {
  return balls.map((b) => ({ ...b }));
}

export function cueBall(balls: readonly Ball[]): Ball | undefined {
  return balls.find((b) => b.kind === 'cue');
}

/* ── the simulation ──────────────────────────────────────────────────────── */

/**
 * Put a ball back inside the rounded rectangle and reflect it off the cushion.
 *
 * A projection, not a sweep, and that is the point: however far the ball has
 * moved, it ends up on the inside. There is no delta large enough to escape,
 * so containment is structural rather than a matter of stepping finely enough.
 * The corner arc is coinTumble's, which is what keeps balls out of square
 * corners the table does not have.
 */
function cushion(b: Ball, t: Table): void {
  const r = b.r;
  const cx = (t.left + t.right) / 2;
  const cy = (t.top + t.bottom) / 2;
  const hw = (t.right - t.left) / 2;
  const hh = (t.bottom - t.top) / 2;

  const sx = b.x < cx ? -1 : 1;
  const sy = b.y < cy ? -1 : 1;
  const dx = Math.abs(b.x - cx) - (hw - t.corner);
  const dy = Math.abs(b.y - cy) - (hh - t.corner);

  if (dx > 0 && dy > 0) {
    const dist = Math.hypot(dx, dy);
    const allowed = Math.max(0, t.corner - r);
    if (dist > allowed) {
      const nx = (dx / dist) * sx;
      const ny = (dy / dist) * sy;
      const push = dist - allowed;
      b.x -= nx * push;
      b.y -= ny * push;
      const vn = b.vx * nx + b.vy * ny;
      if (vn > 0) {
        b.vx -= (1 + CUSHION_RESTITUTION) * vn * nx;
        b.vy -= (1 + CUSHION_RESTITUTION) * vn * ny;
        b.vx *= CUSHION_FRICTION;
        b.vy *= CUSHION_FRICTION;
      }
    }
    return;
  }

  if (b.x < t.left + r) {
    b.x = t.left + r;
    if (b.vx < 0) {
      b.vx = -b.vx * CUSHION_RESTITUTION;
      b.vy *= CUSHION_FRICTION;
    }
  } else if (b.x > t.right - r) {
    b.x = t.right - r;
    if (b.vx > 0) {
      b.vx = -b.vx * CUSHION_RESTITUTION;
      b.vy *= CUSHION_FRICTION;
    }
  }

  if (b.y < t.top + r) {
    b.y = t.top + r;
    if (b.vy < 0) {
      b.vy = -b.vy * CUSHION_RESTITUTION;
      b.vx *= CUSHION_FRICTION;
    }
  } else if (b.y > t.bottom - r) {
    b.y = t.bottom - r;
    if (b.vy > 0) {
      b.vy = -b.vy * CUSHION_RESTITUTION;
      b.vx *= CUSHION_FRICTION;
    }
  }
}

/** Separate two overlapping balls and trade the velocity along the contact normal. */
function collidePair(a: Ball, b: Ball): void {
  let nx = b.x - a.x;
  let ny = b.y - a.y;
  let dist = Math.hypot(nx, ny);
  const min = a.r + b.r;
  if (dist >= min) return;

  if (dist === 0) {
    // Perfectly stacked. Nudge them apart along a fixed axis rather than
    // dividing by zero.
    nx = 0;
    ny = -1;
    dist = 0.0001;
  } else {
    nx /= dist;
    ny /= dist;
  }

  const overlap = (min - dist) / 2;
  a.x -= nx * overlap;
  a.y -= ny * overlap;
  b.x += nx * overlap;
  b.y += ny * overlap;

  const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (vn > 0) return; // already separating

  const impulse = -(1 + BALL_RESTITUTION) * vn * 0.5;
  a.vx -= impulse * nx;
  a.vy -= impulse * ny;
  b.vx += impulse * nx;
  b.vy += impulse * ny;
}

/** A ball whose centre reaches a pocket mouth is out of play, parked in the hole. */
function dropIn(b: Ball, t: Table): void {
  for (const p of t.pockets) {
    if (Math.hypot(b.x - p.x, b.y - p.y) <= p.r) {
      b.potted = true;
      b.vx = 0;
      b.vy = 0;
      b.x = p.x;
      b.y = p.y;
      return;
    }
  }
}

function advance(balls: Ball[], t: Table, h: number): void {
  for (const b of balls) {
    if (b.potted) continue;
    const speed = Math.hypot(b.vx, b.vy);
    if (speed === 0) continue;
    const slowed = speed - DECEL * h;
    if (slowed <= STOP_SPEED) {
      b.vx = 0;
      b.vy = 0;
      continue;
    }
    const scale = slowed / speed;
    b.vx *= scale;
    b.vy *= scale;
    b.x += b.vx * h;
    b.y += b.vy * h;
  }

  // Several relaxation passes, not coinTumble's two: a break drives the cue
  // into a cluster five rows deep, and one pass carries the impulse exactly one
  // contact into it. Too few and the rack shrugs off a full-power break. Each
  // round must end on the cushions, so nothing is left resolved outside them.
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < balls.length; i++) {
      if (balls[i].potted) continue;
      for (let j = i + 1; j < balls.length; j++) {
        if (balls[j].potted) continue;
        collidePair(balls[i], balls[j]);
      }
    }
    for (const b of balls) if (!b.potted) cushion(b, t);
  }

  for (const b of balls) if (!b.potted) dropIn(b, t);
}

function anyMoving(balls: readonly Ball[]): boolean {
  for (const b of balls) if (!b.potted && (b.vx !== 0 || b.vy !== 0)) return true;
  return false;
}

/**
 * Advance the table by `dt` seconds. Returns true while anything is still
 * rolling, so the caller can stop its animation frame loop.
 *
 * The sub-division is the whole safety story. Every collision test in here is
 * a test of where things are, not of where they have been, so the frame is cut
 * into pieces small enough that nothing can cross a cushion or another ball
 * inside one of them.
 */
export function step(balls: Ball[], table: Table, dt: number): boolean {
  // A non-finite delta would turn every coordinate on the table to NaN in one
  // frame, and there would be nothing left to recover from.
  const h = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), MAX_DT) : 0;
  if (h === 0) return anyMoving(balls);

  let fastest = 0;
  for (const b of balls) {
    if (b.potted) continue;
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > fastest) fastest = speed;
  }
  if (fastest === 0) return false;

  const subs = Math.min(MAX_SUBS, Math.max(1, Math.ceil((fastest * h) / MAX_ADVANCE)));
  const sub = h / subs;
  for (let i = 0; i < subs; i++) advance(balls, table, sub);

  return anyMoving(balls);
}

/**
 * Run the table to a standstill without animating it — the reduced-motion path,
 * and how a test gets to the end of a shot.
 */
export function settle(balls: Ball[], table: Table, cap = 4000): void {
  for (let i = 0; i < cap; i++) {
    if (!step(balls, table, 1 / 120)) return;
  }
}

/** Send the cue ball off. `power` is 0..1; `angle` is radians, y downward. */
export function strike(balls: Ball[], angle: number, power: number): void {
  const cue = cueBall(balls);
  if (!cue || cue.potted) return;
  const p = Math.min(1, Math.max(0, power));
  const speed = MIN_SHOT + p * (MAX_SHOT - MIN_SHOT);
  cue.vx = Math.cos(angle) * speed;
  cue.vy = Math.sin(angle) * speed;
}

/** Put a scratched cue ball back on the table, clear of everything else. */
export function respotCue(balls: Ball[], table: Table): void {
  const cue = cueBall(balls);
  if (!cue) return;
  cue.potted = false;
  cue.vx = 0;
  cue.vy = 0;
  cue.x = CENTRE_X;
  cue.y = HEAD_Y;

  const clear = (y: number): boolean => {
    if (y < table.top + cue.r || y > table.bottom - cue.r) return false;
    for (const b of balls) {
      if (b === cue || b.potted) continue;
      if (Math.hypot(b.x - CENTRE_X, b.y - y) < b.r + cue.r + 1) return false;
    }
    return true;
  };

  for (let away = 0; away <= 140; away += 3) {
    if (clear(HEAD_Y + away)) {
      cue.y = HEAD_Y + away;
      return;
    }
    if (clear(HEAD_Y - away)) {
      cue.y = HEAD_Y - away;
      return;
    }
  }
}

/* ── reading a shot ──────────────────────────────────────────────────────── */

export function pottedThisShot(before: readonly Ball[], after: readonly Ball[]): Ball[] {
  const was = new Map(before.map((b) => [b.id, b.potted]));
  return after.filter((b) => b.potted && was.get(b.id) === false);
}

export type Group = 'solid' | 'stripe';
/** Who is on what. Both are null until the first ball goes down. */
export type Groups = { A: Group | null; S: Group | null };

export const OPEN_TABLE: Groups = { A: null, S: null };

export function other(who: Person): Person {
  return who === 'A' ? 'S' : 'A';
}

export function leftOf(balls: readonly Ball[], group: Group): number {
  let n = 0;
  for (const b of balls) if (b.kind === group && !b.potted) n++;
  return n;
}

export type Ending = 'eight' | 'early-eight' | 'scratch-on-eight';

export type ShotOutcome = {
  potted: Ball[];
  scratched: boolean;
  /** Groups after the shot — the first pot on an open table settles them. */
  groups: Groups;
  /** The shooter keeps the table. */
  again: boolean;
  next: Person;
  winner: Person | null;
  ending: Ending | null;
};

/**
 * Judge one shot against the rules the screen states: open table until someone
 * pots, then you are on that group; the eight goes last.
 *
 * Whether the shooter was on the eight is read from `before`, not `after`.
 * Clearing your last ball and the eight on the same stroke is the eight going
 * early — which is the ordinary rule everywhere, and the only reading that
 * makes "the eight goes last" mean anything.
 */
export function judgeShot(
  shooter: Person,
  groups: Groups,
  before: readonly Ball[],
  after: readonly Ball[],
): ShotOutcome {
  const potted = pottedThisShot(before, after);
  const scratched = potted.some((b) => b.kind === 'cue');
  const eightDown = potted.some((b) => b.kind === 'eight');
  const mine = groups[shooter];
  const onTheEight = mine !== null && leftOf(before, mine) === 0;

  if (eightDown) {
    if (onTheEight && !scratched) {
      return {
        potted,
        scratched,
        groups,
        again: false,
        next: shooter,
        winner: shooter,
        ending: 'eight',
      };
    }
    return {
      potted,
      scratched,
      groups,
      again: false,
      next: other(shooter),
      winner: other(shooter),
      ending: onTheEight ? 'scratch-on-eight' : 'early-eight',
    };
  }

  // Open table: the first group down settles it. One of each leaves it open,
  // which is the simplest honest answer and needs no umpire.
  let settled = groups;
  if (mine === null) {
    const solid = potted.some((b) => b.kind === 'solid');
    const stripe = potted.some((b) => b.kind === 'stripe');
    if (solid !== stripe) {
      const taken: Group = solid ? 'solid' : 'stripe';
      const rest: Group = solid ? 'stripe' : 'solid';
      settled = shooter === 'A' ? { A: taken, S: rest } : { A: rest, S: taken };
    }
  }

  const own = settled[shooter];
  const scored =
    own === null
      ? potted.some((b) => b.kind === 'solid' || b.kind === 'stripe')
      : potted.some((b) => b.kind === own);
  const again = scored && !scratched;

  return {
    potted,
    scratched,
    groups: settled,
    again,
    next: again ? shooter : other(shooter),
    winner: null,
    ending: null,
  };
}
