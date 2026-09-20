/**
 * A very small rigid-body simulation for the coins in the jar.
 *
 * The first attempt at "shake the money" was a CSS keyframe that nudged each
 * coin and rotated it back to its slot. It read as the jar wobbling rather
 * than the money moving, for two reasons: the coins always returned to exactly
 * where they started, and rotation is invisible on a circle. So this does the
 * real thing — gravity, walls, and coins knocking into each other. They land
 * where they land.
 *
 * Coordinates are the jar SVG's own 200x250 viewBox, so the numbers here line
 * up with COIN_SLOTS and JAR_BODY_PATH without any conversion.
 */

export type Coin = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /**
   * A coin at rest stops being integrated.
   *
   * Without this the jar never settles: a coin sitting on the floor still has
   * gravity added every frame, the wall bounces a fraction of it back, and its
   * speed never falls under the sleep threshold — so the animation frame loop
   * runs forever and quietly eats the battery.
   */
  asleep?: boolean;
  /** Consecutive frames this coin has barely moved. See the sleep rule in step. */
  still?: number;
};

/**
 * The jar body is a rounded rectangle: x 30..170, y 22..248, corner radius 42.
 * Matches JAR_BODY_PATH — change one and you must change the other.
 */
const LEFT = 30;
const RIGHT = 170;
const TOP = 22;
const BOTTOM = 248;
const CORNER = 42;

/** Wall thickness the coins should sit inside, so they never straddle the stroke. */
const INSET = 2;

const GRAVITY = 900; // viewBox units per second²
const RESTITUTION = 0.42; // how much speed survives a bounce
const WALL_FRICTION = 0.82;
const AIR_DRAG = 0.6; // per second
/**
 * How little a coin must travel in a frame to count as stopped, and for how
 * many frames running.
 *
 * Stillness is the signal, not speed. A coin pressed into the pile accumulates
 * a large velocity that the positional solver cancels every frame — it sits
 * motionless carrying a fictional 45 units per second — so a speed threshold
 * alone never fires. Requiring several consecutive still frames avoids
 * mistaking the apex of a bounce, where one frame's drift is also near zero.
 */
const SLEEP_DRIFT = 0.2;
const SLEEP_FRAMES = 4;
/** An impulse above this wakes a sleeping neighbour. */
const WAKE_IMPULSE = 6;

const CX = (LEFT + RIGHT) / 2;
const CY = (TOP + BOTTOM) / 2;
const HW = (RIGHT - LEFT) / 2;
const HH = (BOTTOM - TOP) / 2;

/**
 * Push a coin back inside the rounded rectangle and reflect its velocity.
 * Straight walls clamp; the corners resolve against the arc, which is what
 * keeps coins from piling into the square corners the jar does not have.
 */
function collideWalls(c: Coin): void {
  const r = c.r + INSET;

  const sx = c.x < CX ? -1 : 1;
  const sy = c.y < CY ? -1 : 1;
  const dx = Math.abs(c.x - CX) - (HW - CORNER);
  const dy = Math.abs(c.y - CY) - (HH - CORNER);

  if (dx > 0 && dy > 0) {
    // Corner region: measure from the centre of the corner's arc.
    const dist = Math.hypot(dx, dy);
    const allowed = CORNER - r;
    if (dist > allowed) {
      const nx = (dx / dist) * sx;
      const ny = (dy / dist) * sy;
      const push = dist - allowed;
      c.x -= nx * push;
      c.y -= ny * push;
      const vn = c.vx * nx + c.vy * ny;
      if (vn > 0) {
        c.vx -= (1 + RESTITUTION) * vn * nx;
        c.vy -= (1 + RESTITUTION) * vn * ny;
        c.vx *= WALL_FRICTION;
        c.vy *= WALL_FRICTION;
      }
    }
    return;
  }

  // Straight walls.
  if (c.x < LEFT + r) {
    c.x = LEFT + r;
    if (c.vx < 0) { c.vx = -c.vx * RESTITUTION; c.vy *= WALL_FRICTION; }
  } else if (c.x > RIGHT - r) {
    c.x = RIGHT - r;
    if (c.vx > 0) { c.vx = -c.vx * RESTITUTION; c.vy *= WALL_FRICTION; }
  }
  if (c.y < TOP + r) {
    c.y = TOP + r;
    if (c.vy < 0) { c.vy = -c.vy * RESTITUTION; c.vx *= WALL_FRICTION; }
  } else if (c.y > BOTTOM - r) {
    c.y = BOTTOM - r;
    if (c.vy > 0) { c.vy = -c.vy * RESTITUTION; c.vx *= WALL_FRICTION; }
  }
}

/** Separate overlapping coins and trade the velocity along the contact normal. */
function collidePair(a: Coin, b: Coin): void {
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

  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn > 0) return; // already separating

  const impulse = -(1 + RESTITUTION) * vn * 0.5;
  a.vx -= impulse * nx;
  a.vy -= impulse * ny;
  b.vx += impulse * nx;
  b.vy += impulse * ny;

  // Wake a sleeping neighbour that has genuinely been knocked. Deliberately
  // does NOT touch an awake coin's still counter: inside a settling pile the
  // impulse is computed from velocities the solver is about to cancel, so it
  // stays large forever and would keep resetting the countdown to sleep.
  if (impulse > WAKE_IMPULSE) {
    if (a.asleep) {
      a.asleep = false;
      a.still = 0;
    }
    if (b.asleep) {
      b.asleep = false;
      b.still = 0;
    }
  }
}

/**
 * Advance the simulation. `gx`/`gy` are the gravity direction as a unit-ish
 * vector — normally (0, 1), but fed from the accelerometer it lets the coins
 * slide when the phone is tilted.
 *
 * Returns true while anything is still moving, so the caller can stop the
 * animation frame loop once the jar has settled.
 */
export function step(coins: Coin[], dt: number, gx = 0, gy = 1): boolean {
  // Clamp: a backgrounded tab can hand back a a huge delta, and a huge delta
  // tunnels coins straight through the walls.
  const h = Math.min(dt, 1 / 30);

  const wasX = coins.map((c) => c.x);
  const wasY = coins.map((c) => c.y);

  for (const c of coins) {
    if (c.asleep) continue;
    c.vx += GRAVITY * gx * h;
    c.vy += GRAVITY * gy * h;
    const drag = Math.max(0, 1 - AIR_DRAG * h);
    c.vx *= drag;
    c.vy *= drag;
    c.x += c.vx * h;
    c.y += c.vy * h;
  }

  // A couple of relaxation passes settle a pile far better than one.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < coins.length; i++) {
      for (let j = i + 1; j < coins.length; j++) collidePair(coins[i], coins[j]);
    }
    for (const c of coins) collideWalls(c);
  }

  // Anything slow that also went nowhere has come to rest. Both conditions
  // matter: speed alone never drops, because gravity keeps topping it up
  // against whatever the coin is lying on.
  let moving = false;
  for (let i = 0; i < coins.length; i++) {
    const c = coins[i];
    if (c.asleep) continue;

    if (Math.hypot(c.x - wasX[i], c.y - wasY[i]) < SLEEP_DRIFT) {
      c.still = (c.still ?? 0) + 1;
    } else {
      c.still = 0;
    }

    if ((c.still ?? 0) >= SLEEP_FRAMES) {
      c.asleep = true;
      // The velocity it went to sleep holding was never real movement.
      c.vx = 0;
      c.vy = 0;
    } else {
      moving = true;
    }
  }
  return moving;
}

/** Fling every coin. Called on a shake or a tap. */
export function kick(coins: Coin[], strength = 1, rand: () => number = Math.random): void {
  for (const c of coins) {
    c.asleep = false;
    c.still = 0;
    c.vx += (rand() * 2 - 1) * 260 * strength;
    // Upward bias — shaking a jar throws the contents up, not sideways.
    c.vy -= (90 + rand() * 300) * strength;
  }
}

/** Start the coins at their designed slot positions, at rest. */
export function fromSlots(slots: ReadonlyArray<readonly [number, number, number]>): Coin[] {
  return slots.map(([x, y, r]) => ({ x, y, vx: 0, vy: 0, r, asleep: false, still: 0 }));
}
