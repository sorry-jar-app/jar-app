import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drop, emptyBoard, findWin, legalMoves, other, type Board } from './board.ts';
import { bestMove } from './solver.ts';
import type { Person } from '../../types.ts';

function place(cols: Array<[number, Person]>): Board {
  let b = emptyBoard();
  for (const [col, who] of cols) b = drop(b, col, who)!;
  return b;
}

/** Deterministic, so a failure can be reproduced. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test('it takes a win that is there for the taking', () => {
  // A has three on the floor at 0,1,2 — column 3 finishes it.
  const b = place([
    [0, 'A'], [0, 'S'],
    [1, 'A'], [1, 'S'],
    [2, 'A'], [2, 'S'],
  ]);
  assert.equal(bestMove(b, 'A', 'proper'), 3);
});

test('it takes a vertical win', () => {
  const b = place([
    [2, 'A'], [3, 'S'],
    [2, 'A'], [3, 'S'],
    [2, 'A'], [3, 'S'],
  ]);
  assert.equal(bestMove(b, 'A', 'proper'), 2);
});

test('it blocks a loss it cannot otherwise avoid', () => {
  // S threatens 0,1,2 on the floor. A has nothing of its own.
  const b = place([
    [0, 'S'], [0, 'A'],
    [1, 'S'], [1, 'A'],
    [2, 'S'], [6, 'A'],
  ]);
  assert.equal(bestMove(b, 'A', 'proper'), 3);
});

test('winning beats blocking when both are available', () => {
  // Both sides are one move from four on the floor, and column 3 completes
  // either. Taking it wins; declining it loses.
  const b = place([
    [0, 'A'], [4, 'S'],
    [1, 'A'], [5, 'S'],
    [2, 'A'], [6, 'S'],
  ]);
  assert.equal(bestMove(b, 'A', 'proper'), 3);
});

test('both levels always return a legal column', () => {
  for (const level of ['easy', 'proper'] as const) {
    for (let seed = 1; seed <= 25; seed++) {
      const rand = seeded(seed);
      let b = emptyBoard();
      let turn: Person = 'A';
      // Play a random-ish opening, then ask.
      for (let i = 0; i < 10 && !findWin(b) && legalMoves(b).length; i++) {
        const moves = legalMoves(b);
        b = drop(b, moves[Math.floor(rand() * moves.length)], turn)!;
        turn = other(turn);
      }
      if (findWin(b) || legalMoves(b).length === 0) continue;
      const move = bestMove(b, turn, level, rand);
      assert.ok(legalMoves(b).includes(move), `${level} seed ${seed} chose ${move}`);
    }
  }
});

test('a full column is never chosen', () => {
  let b = emptyBoard();
  for (let i = 0; i < 6; i++) b = drop(b, 3, i % 2 ? 'A' : 'S')!;
  const move = bestMove(b, 'A', 'proper');
  assert.notEqual(move, 3);
  assert.ok(legalMoves(b).includes(move));
});

test('a board with one column left returns that column', () => {
  let b = emptyBoard();
  // Fill every column but 6, alternating so nobody wins on the way.
  const PATTERN: Person[] = ['A', 'A', 'S', 'S', 'A', 'A'];
  const flip = (p: Person): Person => (p === 'A' ? 'S' : 'A');
  for (let col = 0; col < 6; col++) {
    for (let row = 0; row < 6; row++) {
      b = drop(b, col, col % 2 === 0 ? PATTERN[row] : flip(PATTERN[row]))!;
    }
  }
  assert.deepEqual(legalMoves(b), [6]);
  assert.equal(bestMove(b, 'A', 'proper'), 6);
});

test('it returns -1 rather than throwing on a full board', () => {
  let b = emptyBoard();
  const PATTERN: Person[] = ['A', 'A', 'S', 'S', 'A', 'A'];
  const flip = (p: Person): Person => (p === 'A' ? 'S' : 'A');
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row < 6; row++) {
      b = drop(b, col, col % 2 === 0 ? PATTERN[row] : flip(PATTERN[row]))!;
    }
  }
  assert.equal(bestMove(b, 'A', 'proper'), -1);
});

test('proper beats easy over a run of games', () => {
  // Not a strict guarantee of chess strength, but if the search is wired up
  // backwards this is the test that notices.
  let properWins = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const rand = seeded(seed);
    let b = emptyBoard();
    let turn: Person = seed % 2 === 0 ? 'A' : 'S'; // alternate who starts
    let winner: Person | null = null;

    for (let ply = 0; ply < 42; ply++) {
      const level = turn === 'A' ? 'proper' : 'easy';
      const move = bestMove(b, turn, level, rand);
      if (move < 0) break;
      b = drop(b, move, turn)!;
      const win = findWin(b);
      if (win) {
        winner = win.who;
        break;
      }
      turn = other(turn);
    }
    if (winner === 'A') properWins++;
  }
  assert.ok(properWins >= 6, `proper won only ${properWins}/8`);
});

test('the search stays inside its time budget', () => {
  const b = place([[3, 'A'], [3, 'S'], [2, 'A'], [4, 'S']]);
  const started = performance.now();
  bestMove(b, 'A', 'proper');
  const took = performance.now() - started;
  // Budget is 220ms; allow generous headroom for a cold JIT on CI.
  assert.ok(took < 1500, `took ${took.toFixed(0)}ms`);
});
