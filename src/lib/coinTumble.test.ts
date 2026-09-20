import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COIN_SLOTS } from './constants.ts';
import { fromSlots, kick, step, type Coin } from './coinTumble.ts';

/** The jar body, mirroring the constants in coinTumble. */
const LEFT = 30, RIGHT = 170, TOP = 22, BOTTOM = 248, CORNER = 42, INSET = 2;
const CX = (LEFT + RIGHT) / 2, CY = (TOP + BOTTOM) / 2;
const HW = (RIGHT - LEFT) / 2, HH = (BOTTOM - TOP) / 2;

/** How far a coin's edge sits outside the rounded-rect wall. Negative is inside. */
function overhang(c: Coin): number {
  const r = c.r + INSET;
  const dx = Math.abs(c.x - CX) - (HW - CORNER);
  const dy = Math.abs(c.y - CY) - (HH - CORNER);
  if (dx > 0 && dy > 0) return Math.hypot(dx, dy) - (CORNER - r);
  return Math.max(dx - (CORNER - r), dy - (CORNER - r));
}

/** A deterministic stand-in for Math.random, so a failure can be reproduced. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function settle(coins: Coin[], frames: number, dt = 1 / 60): void {
  for (let i = 0; i < frames; i++) step(coins, dt);
}

test('coins start exactly on their designed slots', () => {
  const coins = fromSlots(COIN_SLOTS.slice(0, 5));
  assert.equal(coins.length, 5);
  assert.deepEqual(
    coins.map((c) => [c.x, c.y, c.r]),
    COIN_SLOTS.slice(0, 5).map(([x, y, r]) => [x, y, r]),
  );
  assert.ok(coins.every((c) => c.vx === 0 && c.vy === 0));
});

test('a full jar shaken hard never lets a coin out of the glass', () => {
  // The whole point of the simulation: coins are clipped to the jar, so one
  // that escapes does not look adventurous, it looks like it vanished.
  for (let seed = 1; seed <= 40; seed++) {
    const rand = seeded(seed);
    const coins = fromSlots(COIN_SLOTS);
    for (let shake = 0; shake < 3; shake++) {
      kick(coins, 1.5, rand);
      for (let f = 0; f < 200; f++) {
        step(coins, 1 / 60);
        const worst = Math.max(...coins.map(overhang));
        assert.ok(worst <= 0.5, `seed ${seed}: coin escaped by ${worst.toFixed(2)}`);
      }
    }
  }
});

test('a long frame cannot tunnel a coin through a wall', () => {
  // A backgrounded tab hands back a huge delta; step clamps it for this reason.
  const coins = fromSlots(COIN_SLOTS);
  kick(coins, 3, seeded(7));
  for (let i = 0; i < 40; i++) step(coins, 2);
  assert.ok(Math.max(...coins.map(overhang)) <= 0.5);
});

test('the jar comes to rest rather than jittering forever', () => {
  const coins = fromSlots(COIN_SLOTS);
  kick(coins, 1, seeded(3));
  let moving = true;
  let frames = 0;
  while (moving && frames < 2000) {
    moving = step(coins, 1 / 60);
    frames++;
  }
  assert.equal(moving, false, 'never settled');
  assert.ok(frames < 2000, `took ${frames} frames`);
});

test('coins end up piled at the bottom, not floating', () => {
  const coins = fromSlots(COIN_SLOTS);
  kick(coins, 1, seeded(11));
  settle(coins, 900);
  const mean = coins.reduce((a, c) => a + c.y, 0) / coins.length;
  assert.ok(mean > CY, `gravity did not win: mean y ${mean.toFixed(1)} vs centre ${CY}`);
});

test('resting coins do not overlap each other', () => {
  const coins = fromSlots(COIN_SLOTS);
  kick(coins, 1, seeded(23));
  settle(coins, 900);
  for (let i = 0; i < coins.length; i++) {
    for (let j = i + 1; j < coins.length; j++) {
      const gap = Math.hypot(coins[i].x - coins[j].x, coins[i].y - coins[j].y);
      assert.ok(gap > coins[i].r + coins[j].r - 1.5, `coins ${i} and ${j} overlap`);
    }
  }
});

test('no coordinate ever goes non-finite', () => {
  const coins = fromSlots(COIN_SLOTS);
  kick(coins, 5, seeded(99));
  settle(coins, 600);
  for (const c of coins) {
    assert.ok(Number.isFinite(c.x) && Number.isFinite(c.y), 'position went NaN');
    assert.ok(Number.isFinite(c.vx) && Number.isFinite(c.vy), 'velocity went NaN');
  }
});

test('an empty jar is not a crash', () => {
  const coins: Coin[] = [];
  kick(coins);
  assert.equal(step(coins, 1 / 60), false);
});

test('two coins stacked at the identical point separate instead of dividing by zero', () => {
  const coins: Coin[] = [
    { x: 100, y: 200, vx: 0, vy: 0, r: 14 },
    { x: 100, y: 200, vx: 0, vy: 0, r: 14 },
  ];
  settle(coins, 120);
  const gap = Math.hypot(coins[0].x - coins[1].x, coins[0].y - coins[1].y);
  assert.ok(Number.isFinite(gap) && gap > 1, `did not separate: ${gap}`);
});
