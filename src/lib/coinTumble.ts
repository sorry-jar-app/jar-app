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

export type Coin = { x: number; y: number; vx: number; vy: number; r: number };

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
const SLEEP_SPEED = 4; // below this, and resting, a coin stops being simulated

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

  for (const c of coins) {
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

  let moving = false;
  for (const c of coins) {
    if (Math.hypot(c.vx, c.vy) > SLEEP_SPEED) {
      moving = true;
      break;
    }
  }
  return moving;
}

/** Fling every coin. Called on a shake or a tap. */
export function kick(coins: Coin[], strength = 1, rand: () => number = Math.random): void {
  for (const c of coins) {
    c.vx += (rand() * 2 - 1) * 260 * strength;
    // Upward bias — shaking a jar throws the contents up, not sideways.
    c.vy -= (90 + rand() * 300) * strength;
  }
}

/** Start the coins at their designed slot positions, at rest. */
export function fromSlots(slots: ReadonlyArray<readonly [number, number, number]>): Coin[] {
  return slots.map(([x, y, r]) => ({ x, y, vx: 0, vy: 0, r }));
}
