/**
 * Breaker — the physics, and nothing else.
 *
 * Deliberately not coinTumble. That module is a settling simulation: gravity,
 * damping, and coins that fall asleep once they stop. Breakout wants the
 * opposite of all three — the ball must never lose speed, never settle, and
 * never stop. What is worth borrowing is the wall geometry, so the ball bounces
 * off the same rounded rectangle the jar is drawn from.
 *
 * Coordinates are the jar SVG's own 200x250 viewBox, so the numbers here line
 * up with JAR_BODY_PATH without any conversion.
 */

import { BRICK_FILLS } from '@/lib/constants';

export type Brick = { x: number; y: number; w: number; h: number; alive: boolean; fill: string };
export type Ball = { x: number; y: number; vx: number; vy: number; r: number };
export type Paddle = { x: number; w: number };

export type Game = {
  ball: Ball;
  paddle: Paddle;
  bricks: Brick[];
  lives: number;
  /** Bricks broken this round. */
  cleared: number;
};

export type StepResult = 'playing' | 'lost-ball' | 'cleared';

/**
 * The jar body: x 30..170, y 22..248, corner radius 42. Matches JAR_BODY_PATH —
 * change one and you must change the other.
 */
const LEFT = 30;
const RIGHT = 170;
const TOP = 22;
const BOTTOM = 248;
const CORNER = 42;

/** Wall thickness the ball sits inside, so it never straddles the stroke. */
const INSET = 2;

const CX = (LEFT + RIGHT) / 2;
const CY = (TOP + BOTTOM) / 2;
const HW = (RIGHT - LEFT) / 2;
const HH = (BOTTOM - TOP) / 2;

/** The viewBox the whole field is expressed in, for mapping a pointer into it. */
export const VIEW_W = 200;
export const VIEW_H = 250;
export const CENTRE_X = CX;

export const BALL_R = 4.5;
export const PADDLE_W = 34;
export const PADDLE_H = 6;

/**
 * The paddle sits above y = 206, where the bottom corner arcs begin, so the
 * whole of its travel is against straight wall. Below that the jar narrows and
 * the arcs would hand the player a save they did not earn.
 */
export const PADDLE_Y = 196;

/** Past here the ball is gone. Chosen to be reachable at every x the ball can hold. */
const LOSE_Y = 210;

export const PADDLE_MIN_X = LEFT + INSET + PADDLE_W / 2;
export const PADDLE_MAX_X = RIGHT - INSET - PADDLE_W / 2;

/**
 * The fallback when nobody says otherwise. In the app the real number comes
 * from the jar — a coin is a life — and is passed into newGame.
 */
export const LIVES = 3;

/** Constant, always. The paddle aims the ball; it never adds energy to it. */
const SPEED = 158;
const PADDLE_SPEED = 430;

/** How far off vertical the very edge of the paddle throws the ball, in radians. */
const MAX_BOUNCE = 1;

/**
 * The least lean the paddle will give the ball, in radians.
 *
 * A dead-centre hit returned perfectly vertically is a rally that never ends:
 * once the ball has drilled its own column out of the wall it goes up and down
 * the empty channel forever. A few degrees of lean means every rally walks
 * sideways and eventually finds something to hit.
 */
const MIN_BOUNCE = 0.12;

/**
 * The least vertical travel the ball is allowed, as a fraction of its speed.
 *
 * A glancing hit on a corner arc can flatten the path to a near-horizontal
 * crawl that nothing in the game will ever lift out of. This is the floor that
 * keeps a round finite.
 */
const MIN_VY = 0.34;

/** Same clamp as coinTumble: a backgrounded tab hands back a huge delta. */
const MAX_DT = 1 / 30;

/**
 * The furthest the ball may travel between collision checks. Under the brick
 * half-height and under the ball radius, which is what makes a hit impossible
 * to step over.
 */
const MAX_ADVANCE = 3;

const COLS = 5;
const ROWS = 4;
const BRICK_W = 22;
const BRICK_H = 9;
const BRICK_GAP_X = 3.5;
const BRICK_GAP_Y = 4.5;
const BRICK_X0 = 38;
const BRICK_Y0 = 76;

export const BRICK_COUNT = COLS * ROWS;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function newBricks(): Brick[] {
  const bricks: Brick[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      bricks.push({
        x: BRICK_X0 + col * (BRICK_W + BRICK_GAP_X),
        y: BRICK_Y0 + row * (BRICK_H + BRICK_GAP_Y),
        w: BRICK_W,
        h: BRICK_H,
        alive: true,
        // Diagonal stagger through the coin palette, so the wall reads as money
        // rather than as a grid.
        fill: BRICK_FILLS[(row + col) % BRICK_FILLS.length],
      });
    }
  }
  return bricks;
}

/** Sit the ball on the paddle, at rest. */
function park(game: Game): void {
  const b = game.ball;
  b.x = clamp(game.paddle.x, PADDLE_MIN_X, PADDLE_MAX_X);
  b.y = PADDLE_Y - b.r - 1;
  b.vx = 0;
  b.vy = 0;
}

/** Launch the parked ball. The lean keeps two rounds from opening identically. */
export function serve(game: Game, rand: () => number = Math.random): void {
  park(game);
  const angle = (rand() * 2 - 1) * 0.5;
  game.ball.vx = Math.sin(angle) * SPEED;
  game.ball.vy = -Math.cos(angle) * SPEED;
}

export function newGame(rand: () => number = Math.random, lives: number = LIVES): Game {
  const game: Game = {
    ball: { x: CX, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0, r: BALL_R },
    paddle: { x: CX, w: PADDLE_W },
    bricks: newBricks(),
    lives: Math.max(1, Math.floor(lives)),
    cleared: 0,
  };
  serve(game, rand);
  return game;
}

/**
 * Put a finished game back to the start without replacing it, so the caller's
 * DOM nodes stay bound to the same bricks.
 */
export function restart(
  game: Game,
  rand: () => number = Math.random,
  lives: number = LIVES,
): void {
  for (const brick of game.bricks) brick.alive = true;
  game.lives = Math.max(1, Math.floor(lives));
  game.cleared = 0;
  game.paddle.x = CX;
  serve(game, rand);
}

/**
 * Keep the ball inside the rounded rectangle and reflect it perfectly.
 *
 * This is a projection, not a sweep, and that is the point: whatever the delta,
 * however far the ball has moved, it is put back on the inside of the boundary.
 * There is no delta large enough to escape, so containment is structural rather
 * than a matter of stepping finely enough.
 */
function contain(b: Ball): void {
  const r = b.r + INSET;

  const sx = b.x < CX ? -1 : 1;
  const sy = b.y < CY ? -1 : 1;
  const dx = Math.abs(b.x - CX) - (HW - CORNER);
  const dy = Math.abs(b.y - CY) - (HH - CORNER);

  if (dx > 0 && dy > 0) {
    // Corner region: measured from the centre of that corner's arc.
    const dist = Math.hypot(dx, dy);
    const allowed = CORNER - r;
    if (dist > allowed) {
      const nx = (dx / dist) * sx;
      const ny = (dy / dist) * sy;
      const push = dist - allowed;
      b.x -= nx * push;
      b.y -= ny * push;
      const vn = b.vx * nx + b.vy * ny;
      if (vn > 0) {
        b.vx -= 2 * vn * nx;
        b.vy -= 2 * vn * ny;
      }
    }
    return;
  }

  if (b.x < LEFT + r) {
    b.x = LEFT + r;
    if (b.vx < 0) b.vx = -b.vx;
  } else if (b.x > RIGHT - r) {
    b.x = RIGHT - r;
    if (b.vx > 0) b.vx = -b.vx;
  }
  if (b.y < TOP + r) {
    b.y = TOP + r;
    if (b.vy < 0) b.vy = -b.vy;
  } else if (b.y > BOTTOM - r) {
    b.y = BOTTOM - r;
    if (b.vy > 0) b.vy = -b.vy;
  }
}

/** Bounce off one brick, if the circle touches it at all. */
function bounceOff(b: Ball, brick: Brick): boolean {
  const nearX = clamp(b.x, brick.x, brick.x + brick.w);
  const nearY = clamp(b.y, brick.y, brick.y + brick.h);
  let nx = b.x - nearX;
  let ny = b.y - nearY;
  const d2 = nx * nx + ny * ny;
  if (d2 > b.r * b.r) return false;

  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    nx /= d;
    ny /= d;
    b.x = nearX + nx * b.r;
    b.y = nearY + ny * b.r;
  } else {
    // Centre inside the brick. Leave by whichever face is closest.
    const toLeft = b.x - brick.x;
    const toRight = brick.x + brick.w - b.x;
    const toTop = b.y - brick.y;
    const toBottom = brick.y + brick.h - b.y;
    const least = Math.min(toLeft, toRight, toTop, toBottom);
    nx = 0;
    ny = 0;
    if (least === toLeft) {
      nx = -1;
      b.x = brick.x - b.r;
    } else if (least === toRight) {
      nx = 1;
      b.x = brick.x + brick.w + b.r;
    } else if (least === toTop) {
      ny = -1;
      b.y = brick.y - b.r;
    } else {
      ny = 1;
      b.y = brick.y + brick.h + b.r;
    }
  }

  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    b.vx -= 2 * vn * nx;
    b.vy -= 2 * vn * ny;
  }
  return true;
}

/** At most one brick per sub-step, so a hit is never lost to a double bounce. */
function hitBricks(game: Game): void {
  for (const brick of game.bricks) {
    if (!brick.alive) continue;
    if (bounceOff(game.ball, brick)) {
      brick.alive = false;
      game.cleared += 1;
      return;
    }
  }
}

function hitPaddle(game: Game): boolean {
  const b = game.ball;
  const p = game.paddle;
  if (b.vy <= 0) return false;
  if (b.y + b.r < PADDLE_Y || b.y - b.r > PADDLE_Y + PADDLE_H) return false;

  const reach = p.w / 2 + b.r;
  const off = b.x - p.x;
  if (Math.abs(off) > reach) return false;

  b.y = PADDLE_Y - b.r;
  // Where it lands on the paddle is the whole of the steering. The angle
  // changes, the speed does not — a rally never gets faster than the first hit.
  let angle = clamp(off / reach, -1, 1) * MAX_BOUNCE;
  if (Math.abs(angle) < MIN_BOUNCE) {
    const lean = angle !== 0 ? Math.sign(angle) : b.vx !== 0 ? Math.sign(b.vx) : 1;
    angle = lean * MIN_BOUNCE;
  }
  b.vx = Math.sin(angle) * SPEED;
  b.vy = -Math.cos(angle) * SPEED;
  return true;
}

function enforceSpeed(b: Ball): void {
  const s = Math.hypot(b.vx, b.vy);
  if (s === 0) return;
  b.vx = (b.vx / s) * SPEED;
  b.vy = (b.vy / s) * SPEED;

  const floor = SPEED * MIN_VY;
  if (Math.abs(b.vy) < floor) {
    b.vy = b.vy < 0 ? -floor : floor;
    const rest = Math.sqrt(Math.max(0, SPEED * SPEED - floor * floor));
    b.vx = b.vx < 0 ? -rest : rest;
  }
}

function movePaddle(p: Paddle, targetX: number, h: number): void {
  if (!Number.isFinite(targetX)) return;
  const want = clamp(targetX, PADDLE_MIN_X, PADDLE_MAX_X);
  const most = PADDLE_SPEED * h;
  const gap = want - p.x;
  p.x += Math.abs(gap) <= most ? gap : Math.sign(gap) * most;
}

function advance(game: Game, h: number, targetX: number): StepResult {
  movePaddle(game.paddle, targetX, h);

  const b = game.ball;

  // Exactly zero velocity only ever comes from park(): enforceSpeed holds a
  // live ball at SPEED. So this is the between-lives pause, and the ball rides
  // the paddle until it is served again.
  if (b.vx === 0 && b.vy === 0) {
    b.x = clamp(game.paddle.x, PADDLE_MIN_X, PADDLE_MAX_X);
    b.y = PADDLE_Y - b.r - 1;
    return 'playing';
  }

  b.x += b.vx * h;
  b.y += b.vy * h;

  // Order matters. A brick sitting against a wall can only be reached by a ball
  // that already overlaps it, and bouncing off its outer face throws the ball
  // through the glass — so the walls get the last word, every time.
  hitBricks(game);
  hitPaddle(game);
  contain(b);
  enforceSpeed(b);

  if (game.cleared >= game.bricks.length) return 'cleared';

  if (b.y > LOSE_Y) {
    game.lives = Math.max(0, game.lives - 1);
    park(game);
    return 'lost-ball';
  }
  return 'playing';
}

/**
 * Advance the game by `dt` seconds with the paddle heading for `paddleTargetX`
 * (in viewBox units; it is clamped to what the paddle can actually reach).
 *
 * On 'lost-ball' a life is gone and the ball is parked back on the paddle, so
 * stepping again without serving is harmless — it simply sits there.
 */
export function step(game: Game, dt: number, paddleTargetX: number): StepResult {
  const h = clamp(dt, 0, MAX_DT);
  const travel = Math.hypot(game.ball.vx, game.ball.vy) * h;
  const subs = clamp(Math.ceil(travel / MAX_ADVANCE), 1, 8);
  const sub = h / subs;

  let outcome: StepResult = 'playing';
  for (let i = 0; i < subs && outcome === 'playing'; i++) {
    outcome = advance(game, sub, paddleTargetX);
  }
  return outcome;
}
