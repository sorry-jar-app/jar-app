import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLS,
  ROWS,
  at,
  canDrop,
  drop,
  emptyBoard,
  findWin,
  isFull,
  landingRow,
  legalMoves,
  other,
  outcomeOf,
  type Board,
} from './board.ts';
import type { Person } from '../../types.ts';

/** Play a list of columns alternately, starting with 'A'. */
function play(cols: number[], first: Person = 'A'): Board {
  let board = emptyBoard();
  let turn = first;
  for (const col of cols) {
    const next = drop(board, col, turn);
    assert.ok(next, `column ${col} was full`);
    board = next;
    turn = other(turn);
  }
  return board;
}

test('a new board is empty and every column is open', () => {
  const b = emptyBoard();
  assert.equal(b.length, COLS * ROWS);
  assert.deepEqual(legalMoves(b), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(findWin(b), null);
  assert.equal(isFull(b), false);
});

test('discs stack from the floor upward', () => {
  let b = emptyBoard();
  assert.equal(landingRow(b, 3), 0);
  b = drop(b, 3, 'A')!;
  assert.equal(at(b, 3, 0), 'A');
  assert.equal(landingRow(b, 3), 1);
  b = drop(b, 3, 'S')!;
  assert.equal(at(b, 3, 1), 'S');
  assert.equal(at(b, 3, 2), null);
});

test('a full column is refused rather than silently swallowing a disc', () => {
  let b = emptyBoard();
  for (let i = 0; i < ROWS; i++) b = drop(b, 0, i % 2 ? 'S' : 'A')!;
  assert.equal(canDrop(b, 0), false);
  assert.equal(landingRow(b, 0), -1);
  assert.equal(drop(b, 0, 'A'), null);
  assert.ok(!legalMoves(b).includes(0));
});

test('out-of-range reads are null, not a crash', () => {
  const b = emptyBoard();
  assert.equal(at(b, -1, 0), null);
  assert.equal(at(b, COLS, 0), null);
  assert.equal(at(b, 0, -1), null);
  assert.equal(at(b, 0, ROWS), null);
});

test('wins on all four axes', () => {
  // horizontal — A takes 0,1,2,3 on the floor
  let b = play([0, 0, 1, 1, 2, 2, 3]);
  assert.equal(findWin(b)?.who, 'A');

  // vertical — A stacks column 2
  b = play([2, 3, 2, 3, 2, 3, 2]);
  assert.equal(findWin(b)?.who, 'A');

  // diagonal ↗
  b = play([0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]);
  assert.equal(findWin(b)?.who, 'A', 'rising diagonal');

  // diagonal ↘
  b = play([3, 2, 2, 1, 1, 0, 1, 0, 0, 6, 0]);
  assert.equal(findWin(b)?.who, 'A', 'falling diagonal');
});

test('a win reports the four cells that made it', () => {
  const b = play([0, 0, 1, 1, 2, 2, 3]);
  const win = findWin(b);
  assert.equal(win?.cells.length, 4);
  for (const [, row] of win!.cells) assert.equal(row, 0);
});

test('three in a row is not a win', () => {
  const b = play([0, 0, 1, 1, 2]);
  assert.equal(findWin(b), null);
  assert.equal(outcomeOf(b).kind, 'playing');
});

test('a line broken by the other player is not a win', () => {
  // A on 0,1 then S on 2 then A on 3 — four cells, not four of a kind.
  let b = emptyBoard();
  b = drop(b, 0, 'A')!;
  b = drop(b, 1, 'A')!;
  b = drop(b, 2, 'S')!;
  b = drop(b, 3, 'A')!;
  assert.equal(findWin(b), null);
});

test('a filled board with no line is a draw', () => {
  // Every column is AASSAA bottom-up, with odd columns inverted. Runs cap at
  // two vertically, every row alternates, and both diagonals break by the
  // second or third cell because the column parity keeps flipping the colour.
  const PATTERN: Person[] = ['A', 'A', 'S', 'S', 'A', 'A'];
  const flip = (p: Person): Person => (p === 'A' ? 'S' : 'A');

  let b = emptyBoard();
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      b = drop(b, col, col % 2 === 0 ? PATTERN[row] : flip(PATTERN[row]))!;
    }
  }
  assert.equal(isFull(b), true);
  assert.equal(findWin(b), null, 'this fixture is meant to have no line');
  assert.equal(outcomeOf(b).kind, 'draw');
});

test('drop never mutates the board it was given', () => {
  const b = emptyBoard();
  const next = drop(b, 3, 'A');
  assert.equal(at(b, 3, 0), null, 'original was mutated');
  assert.equal(at(next!, 3, 0), 'A');
});

test('other() flips and is its own inverse', () => {
  assert.equal(other('A'), 'S');
  assert.equal(other('S'), 'A');
  assert.equal(other(other('A')), 'A');
});
