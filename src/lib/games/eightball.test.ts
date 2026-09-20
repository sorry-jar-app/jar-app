import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BALL_R,
  CENTRE_X,
  HEAD_Y,
  TABLE,
  judgeShot,
  leftOf,
  newRack,
  pottedThisShot,
  respotCue,
  settle,
  snapshot,
  step,
  strike,
  type Ball,
  type BallKind,
  type Table,
} from './eightball.ts';

/** A deterministic stand-in for Math.random, so a failure can be reproduced. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * How far a ball's edge sits outside the cushion. Negative is inside.
 * Mirrors the geometry in eightball's `cushion` — if one changes the other must.
 */
function overhang(b: Ball, t: Table = TABLE): number {
  const cx = (t.left + t.right) / 2;
  const cy = (t.top + t.bottom) / 2;
  const hw = (t.right - t.left) / 2;
  const hh = (t.bottom - t.top) / 2;
  const dx = Math.abs(b.x - cx) - (hw - t.corner);
  const dy = Math.abs(b.y - cy) - (hh - t.corner);
  const allowed = t.corner - b.r;
  if (dx > 0 && dy > 0) return Math.hypot(dx, dy) - allowed;
  return Math.max(dx - allowed, dy - allowed);
}

function worstOverhang(balls: readonly Ball[], t: Table = TABLE): number {
  let worst = -Infinity;
  for (const b of balls) {
    if (b.potted) continue;
    worst = Math.max(worst, overhang(b, t));
  }
  return worst === -Infinity ? -1 : worst;
}

function loneCue(x = CENTRE_X, y = HEAD_Y): Ball[] {
  return [{ id: 0, x, y, vx: 0, vy: 0, r: BALL_R, kind: 'cue', potted: false }];
}

function firstOf(balls: Ball[], kind: BallKind): Ball {
  const hit = balls.find((b) => b.kind === kind);
  if (!hit) throw new Error(`no ${kind} in the rack`);
  return hit;
}

/** The same table with the holes filled in, for testing the cushions alone. */
const WALLED: Table = { ...TABLE, pockets: [] };

test('the rack is the same rack for the same seed', () => {
  assert.deepEqual(newRack(seeded(12)), newRack(seeded(12)));
  assert.deepEqual(newRack(() => 0.5), newRack(() => 0.5));
});

test('a rack is sixteen balls, seven of each and an eight', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const balls = newRack(seeded(seed));
    assert.equal(balls.length, 16);
    assert.equal(balls.filter((b) => b.kind === 'cue').length, 1);
    assert.equal(balls.filter((b) => b.kind === 'solid').length, 7);
    assert.equal(balls.filter((b) => b.kind === 'stripe').length, 7);
    assert.equal(balls.filter((b) => b.kind === 'eight').length, 1);
    // The two things a real rack fixes: the eight in the middle of the third
    // row, and one of each in the back corners.
    assert.equal(balls[5].kind, 'eight');
    assert.notEqual(balls[11].kind, balls[15].kind);
    assert.ok(balls[11].kind === 'solid' || balls[11].kind === 'stripe');
    assert.ok(balls[15].kind === 'solid' || balls[15].kind === 'stripe');
  }
});

test('nothing starts overlapping, off the table, or already down a pocket', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const balls = newRack(seeded(seed));
    assert.ok(worstOverhang(balls) <= 0, 'a ball is racked outside the cushions');
    for (const b of balls) {
      assert.equal(b.potted, false);
      for (const p of TABLE.pockets) {
        assert.ok(Math.hypot(b.x - p.x, b.y - p.y) > p.r, 'a ball is racked in a pocket');
      }
    }
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const gap = Math.hypot(balls[i].x - balls[j].x, balls[i].y - balls[j].y);
        assert.ok(gap >= balls[i].r + balls[j].r, `balls ${i} and ${j} start touching`);
      }
    }
  }
});

test('no ball ever leaves the table, however hard it is hit', () => {
  // The whole point of the sub-stepping. A ball that tunnels out does not look
  // adventurous, it looks like it was never there.
  for (let seed = 1; seed <= 40; seed++) {
    const rand = seeded(seed);
    const balls = newRack(rand);
    for (let shot = 0; shot < 4; shot++) {
      const cue = balls[0];
      if (cue.potted) respotCue(balls, TABLE);
      strike(balls, rand() * Math.PI * 2, 1);
      for (let f = 0; f < 500; f++) {
        const moving = step(balls, TABLE, 1 / 60);
        const worst = worstOverhang(balls);
        assert.ok(worst <= 1e-6, `seed ${seed} shot ${shot}: out by ${worst.toFixed(4)}`);
        if (!moving) break;
      }
    }
  }
});

test('maximum power straight into a corner cannot punch through it', () => {
  // The nastiest case there is: one ball, nothing to bleed the speed off, fired
  // flat into the tightest geometry on the table. Pocketless, so the corner
  // does not get to swallow the evidence.
  const corners = [
    { x: WALLED.left, y: WALLED.top },
    { x: WALLED.right, y: WALLED.top },
    { x: WALLED.left, y: WALLED.bottom },
    { x: WALLED.right, y: WALLED.bottom },
  ];

  for (const corner of corners) {
    for (let nudge = -8; nudge <= 8; nudge++) {
      const balls = loneCue();
      const cue = balls[0];
      const angle = Math.atan2(corner.y - cue.y, corner.x - cue.x) + nudge * 0.025;
      strike(balls, angle, 1);
      for (let f = 0; f < 600; f++) {
        const moving = step(balls, WALLED, 1 / 60);
        const worst = worstOverhang(balls, WALLED);
        assert.ok(worst <= 1e-6, `corner ${corner.x},${corner.y}: out by ${worst.toFixed(4)}`);
        if (!moving) break;
      }
    }
  }
});

test('a very long frame cannot tunnel a ball out', () => {
  // A backgrounded tab hands back a huge delta; step clamps it for this reason,
  // and then still sub-divides what is left.
  for (const dt of [0.4, 2, 30, 600]) {
    const rand = seeded(17);
    const balls = newRack(rand);
    strike(balls, -Math.PI / 2 + 0.11, 1);
    for (let f = 0; f < 120; f++) {
      step(balls, TABLE, dt);
      const worst = worstOverhang(balls);
      assert.ok(worst <= 1e-6, `dt ${dt}: out by ${worst.toFixed(4)}`);
    }
  }
});

test('every shot comes to rest, and step eventually says so', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const rand = seeded(seed);
    const balls = newRack(rand);
    strike(balls, rand() * Math.PI * 2, 1);
    let frames = 0;
    let moving = true;
    while (moving && frames < 1500) {
      moving = step(balls, TABLE, 1 / 60);
      frames++;
    }
    assert.equal(moving, false, `seed ${seed} never settled — ${frames} frames`);
  }
});

test('a potted ball leaves the table and stays left', () => {
  const balls = loneCue();
  const cue = balls[0];
  const pocket = TABLE.pockets[0];
  strike(balls, Math.atan2(pocket.y - cue.y, pocket.x - cue.x), 1);

  let f = 0;
  while (!cue.potted && f < 600) {
    step(balls, TABLE, 1 / 60);
    f++;
  }
  assert.ok(cue.potted, 'aimed straight at a corner and it did not drop');
  assert.equal(step(balls, TABLE, 1 / 60), false, 'a table of potted balls still reports motion');

  const parked = { x: cue.x, y: cue.y };
  for (let i = 0; i < 200; i++) step(balls, TABLE, 1 / 60);
  assert.deepEqual({ x: cue.x, y: cue.y }, parked, 'a potted ball moved again');
});

test('a potted ball does not shove the next one about from where it sits', () => {
  // Potting parks a ball in the hole, which is a place a live ball can also
  // reach. If the pair pass did not skip it, a pocketed ball would still be
  // deflecting traffic — and the deflection would come from beyond the cushion.
  const ghost: Ball = { id: 0, x: 100, y: 200, vx: 0, vy: 0, r: BALL_R, kind: 'solid', potted: true };
  const live: Ball = { id: 1, x: 100, y: 300, vx: 0, vy: 0, r: BALL_R, kind: 'cue', potted: false };
  const balls = [ghost, live];

  const alone = [{ ...live }];

  strike(balls, -Math.PI / 2, 0.6);
  strike(alone, -Math.PI / 2, 0.6);
  for (let f = 0; f < 30; f++) {
    step(balls, WALLED, 1 / 60);
    step(alone, WALLED, 1 / 60);
  }

  assert.deepEqual({ x: ghost.x, y: ghost.y }, { x: 100, y: 200 }, 'the parked ball was moved');
  assert.ok(live.y < 200 - 2 * BALL_R, 'the live ball did not pass straight through');
  assert.deepEqual(
    { x: live.x, y: live.y, vx: live.vx, vy: live.vy },
    { x: alone[0].x, y: alone[0].y, vx: alone[0].vx, vy: alone[0].vy },
    'a ball in a pocket changed the path of a live one',
  );
});

test('no coordinate ever goes non-finite', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const rand = seeded(seed);
    const balls = newRack(rand);
    for (let shot = 0; shot < 3; shot++) {
      if (balls[0].potted) respotCue(balls, TABLE);
      strike(balls, rand() * Math.PI * 2, 1);
      settle(balls, TABLE);
    }
    for (const b of balls) {
      assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y), `seed ${seed}: position went NaN`);
      assert.ok(Number.isFinite(b.vx) && Number.isFinite(b.vy), `seed ${seed}: velocity went NaN`);
    }
  }
});

test('an empty table is not a crash', () => {
  const balls: Ball[] = [];
  strike(balls, 0, 1);
  assert.equal(step(balls, TABLE, 1 / 60), false);
  settle(balls, TABLE);
});

test('two balls dead on top of each other separate instead of dividing by zero', () => {
  const balls: Ball[] = [
    { id: 0, x: 100, y: 180, vx: 0, vy: 0, r: BALL_R, kind: 'cue', potted: false },
    { id: 1, x: 100, y: 180, vx: 20, vy: 0, r: BALL_R, kind: 'solid', potted: false },
  ];
  for (let f = 0; f < 120; f++) step(balls, WALLED, 1 / 60);
  const gap = Math.hypot(balls[0].x - balls[1].x, balls[0].y - balls[1].y);
  assert.ok(Number.isFinite(gap) && gap > 1, `did not separate: ${gap}`);
});

test('a scratched cue comes back on the table and clear of everything', () => {
  const balls = newRack(seeded(9));
  const cue = balls[0];
  cue.potted = true;
  cue.x = TABLE.pockets[4].x;
  cue.y = TABLE.pockets[4].y;
  // Park an object ball on the head spot, so the easy answer is the wrong one.
  balls[1].x = CENTRE_X;
  balls[1].y = HEAD_Y;

  respotCue(balls, TABLE);

  assert.equal(cue.potted, false);
  assert.ok(overhang(cue) <= 0, 'respotted outside the cushions');
  for (const b of balls) {
    if (b === cue || b.potted) continue;
    const gap = Math.hypot(b.x - cue.x, b.y - cue.y);
    assert.ok(gap >= b.r + cue.r, `respotted on top of ball ${b.id}`);
  }
});

/* ── the rules ───────────────────────────────────────────────────────────── */

test('pottedThisShot reports only what went down on this shot', () => {
  const before = newRack(seeded(3));
  before[2].potted = true;
  const after = snapshot(before);
  after[4].potted = true;
  after[7].potted = true;

  const went = pottedThisShot(before, after);
  assert.deepEqual(
    went.map((b) => b.id).sort((a, b) => a - b),
    [after[4].id, after[7].id].sort((a, b) => a - b),
  );
});

test('the first ball down settles both groups', () => {
  const before = newRack(seeded(4));
  const after = snapshot(before);
  firstOf(after, 'stripe').potted = true;

  const out = judgeShot('A', { A: null, S: null }, before, after);
  assert.deepEqual(out.groups, { A: 'stripe', S: 'solid' });
  assert.equal(out.again, true);
  assert.equal(out.next, 'A');
  assert.equal(out.winner, null);
});

test('one of each on an open table leaves it open', () => {
  const before = newRack(seeded(5));
  const after = snapshot(before);
  firstOf(after, 'solid').potted = true;
  firstOf(after, 'stripe').potted = true;

  const out = judgeShot('S', { A: null, S: null }, before, after);
  assert.deepEqual(out.groups, { A: null, S: null });
  assert.equal(out.again, true);
});

test('nothing down hands the table over', () => {
  const before = newRack(seeded(6));
  const after = snapshot(before);

  const out = judgeShot('A', { A: 'solid', S: 'stripe' }, before, after);
  assert.equal(out.again, false);
  assert.equal(out.next, 'S');
  assert.equal(out.scratched, false);
});

test('potting one of theirs does not earn another shot', () => {
  const before = newRack(seeded(7));
  const after = snapshot(before);
  firstOf(after, 'stripe').potted = true;

  const out = judgeShot('A', { A: 'solid', S: 'stripe' }, before, after);
  assert.equal(out.again, false);
  assert.equal(out.next, 'S');
});

test('a scratch hands the table over even after a good pot', () => {
  const before = newRack(seeded(8));
  const after = snapshot(before);
  firstOf(after, 'solid').potted = true;
  firstOf(after, 'cue').potted = true;

  const out = judgeShot('A', { A: 'solid', S: 'stripe' }, before, after);
  assert.equal(out.scratched, true);
  assert.equal(out.again, false);
  assert.equal(out.next, 'S');
  assert.equal(out.winner, null);
});

test('the eight potted early loses the rack', () => {
  const before = newRack(seeded(10));
  const after = snapshot(before);
  firstOf(after, 'eight').potted = true;

  const out = judgeShot('A', { A: 'solid', S: 'stripe' }, before, after);
  assert.equal(out.winner, 'S');
  assert.equal(out.ending, 'early-eight');
});

test('clearing the last of your group and the eight together is still early', () => {
  const before = newRack(seeded(11));
  const solids = before.filter((b) => b.kind === 'solid');
  for (let i = 0; i < solids.length - 1; i++) solids[i].potted = true;
  assert.equal(leftOf(before, 'solid'), 1);

  const after = snapshot(before);
  firstOf(after, 'eight').potted = true;
  const last = after.find((b) => b.kind === 'solid' && !b.potted);
  assert.ok(last);
  last.potted = true;

  const out = judgeShot('A', { A: 'solid', S: 'stripe' }, before, after);
  assert.equal(out.winner, 'S');
  assert.equal(out.ending, 'early-eight');
});

test('the eight potted last takes it', () => {
  const before = newRack(seeded(12));
  for (const b of before) if (b.kind === 'solid') b.potted = true;
  assert.equal(leftOf(before, 'solid'), 0);

  const after = snapshot(before);
  firstOf(after, 'eight').potted = true;

  const out = judgeShot('A', { A: 'solid', S: 'stripe' }, before, after);
  assert.equal(out.winner, 'A');
  assert.equal(out.ending, 'eight');
});

test('the cue ball down with the eight loses it', () => {
  const before = newRack(seeded(13));
  for (const b of before) if (b.kind === 'stripe') b.potted = true;

  const after = snapshot(before);
  firstOf(after, 'eight').potted = true;
  firstOf(after, 'cue').potted = true;

  const out = judgeShot('S', { A: 'solid', S: 'stripe' }, before, after);
  assert.equal(out.winner, 'A');
  assert.equal(out.ending, 'scratch-on-eight');
});

test('the eight on an open table is still early', () => {
  const before = newRack(seeded(14));
  const after = snapshot(before);
  firstOf(after, 'eight').potted = true;

  const out = judgeShot('S', { A: null, S: null }, before, after);
  assert.equal(out.winner, 'A');
  assert.equal(out.ending, 'early-eight');
});

test('a rack really can be played to a finish', () => {
  // Not a rule check — a sanity check that the physics and the rules agree
  // well enough that balls actually go down when a table is hammered at.
  const rand = seeded(21);
  const balls = newRack(rand);
  for (let shot = 0; shot < 60; shot++) {
    if (balls[0].potted) respotCue(balls, TABLE);
    strike(balls, rand() * Math.PI * 2, 0.5 + rand() * 0.5);
    settle(balls, TABLE);
  }
  const down = balls.filter((b) => b.potted && b.kind !== 'cue').length;
  assert.ok(down > 0, 'sixty shots and nothing went in');
});

test('a nonsense delta is ignored rather than turning the table to NaN', () => {
  const balls = newRack(seeded(2));
  strike(balls, -Math.PI / 2, 1);
  for (const dt of [NaN, Infinity, -Infinity, -1]) step(balls, TABLE, dt);
  for (const b of balls) {
    assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y), 'position went NaN');
    assert.ok(Number.isFinite(b.vx) && Number.isFinite(b.vy), 'velocity went NaN');
  }
  assert.ok(worstOverhang(balls) <= 1e-6);
});
