/**
 * Four in a row — the board, and nothing else.
 *
 * Pure and framework-free so it can be tested directly and so the solver, the
 * screen and the remote opponent all agree on what a position is. Uses the
 * app's own Person type, so a disc is simply whose it is.
 */

import type { Person } from '@/lib/types';

export const COLS = 7;
export const ROWS = 6;

export type Cell = Person | null;

/**
 * Column-major, bottom-up: index `col * ROWS + row`, with row 0 the floor.
 * That is the order coins actually stack, so dropping is a scan upward rather
 * than arithmetic run backwards.
 */
export type Board = readonly Cell[];

export function emptyBoard(): Board {
  return new Array<Cell>(COLS * ROWS).fill(null);
}

export function at(board: Board, col: number, row: number): Cell {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
  return board[col * ROWS + row];
}

/** The row a disc dropped into this column would land on, or -1 if it is full. */
export function landingRow(board: Board, col: number): number {
  for (let row = 0; row < ROWS; row++) {
    if (at(board, col, row) === null) return row;
  }
  return -1;
}

export function canDrop(board: Board, col: number): boolean {
  return landingRow(board, col) >= 0;
}

export function legalMoves(board: Board): number[] {
  const moves: number[] = [];
  for (let col = 0; col < COLS; col++) if (canDrop(board, col)) moves.push(col);
  return moves;
}

/** A new board with the disc dropped. Returns null when the column is full. */
export function drop(board: Board, col: number, who: Person): Board | null {
  const row = landingRow(board, col);
  if (row < 0) return null;
  const next = board.slice();
  next[col * ROWS + row] = who;
  return next;
}

export function isFull(board: Board): boolean {
  return legalMoves(board).length === 0;
}

/** The four directions a line can run. The other four are these reversed. */
const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], // →
  [0, 1], // ↑
  [1, 1], // ↗
  [1, -1], // ↘
];

export type Win = { who: Person; cells: Array<[number, number]> };

/**
 * The winning line, if there is one.
 *
 * Returns the cells as well as the winner so the screen can pick them out
 * rather than re-deriving the line it already knows exists.
 */
export function findWin(board: Board): Win | null {
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const who = at(board, col, row);
      if (!who) continue;

      for (const [dc, dr] of DIRECTIONS) {
        const cells: Array<[number, number]> = [[col, row]];
        for (let step = 1; step < 4; step++) {
          if (at(board, col + dc * step, row + dr * step) !== who) break;
          cells.push([col + dc * step, row + dr * step]);
        }
        if (cells.length === 4) return { who, cells };
      }
    }
  }
  return null;
}

export type Outcome = { kind: 'win'; win: Win } | { kind: 'draw' } | { kind: 'playing' };

export function outcomeOf(board: Board): Outcome {
  const win = findWin(board);
  if (win) return { kind: 'win', win };
  if (isFull(board)) return { kind: 'draw' };
  return { kind: 'playing' };
}

export function other(who: Person): Person {
  return who === 'A' ? 'S' : 'A';
}
