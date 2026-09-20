/**
 * The machine, for when the other one is not around.
 *
 * Minimax with alpha–beta over the plain board. No dependency, no worker: the
 * search is time-boxed rather than depth-boxed so a slow phone degrades into a
 * shallower move instead of dropping a frame.
 */

import {
  COLS,
  ROWS,
  at,
  drop,
  findWin,
  isFull,
  legalMoves,
  other,
  type Board,
} from './board';
import type { Person } from '@/lib/types';

export type Level = 'easy' | 'proper';

/** Big enough to dominate any heuristic score, small enough to stay readable. */
const WIN_SCORE = 100_000;

/** Centre columns are worth more: more lines pass through them. */
const COLUMN_BIAS = [0, 1, 2, 4, 2, 1, 0];

/** How long the search may take before it returns the best it has. */
const BUDGET_MS = { easy: 30, proper: 220 } as const;
const MAX_DEPTH = { easy: 2, proper: 8 } as const;

/** Every straight run of four cells on the board, precomputed once. */
const WINDOWS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = (() => {
  const dirs: ReadonlyArray<readonly [number, number]> = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  const out: Array<Array<readonly [number, number]>> = [];
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      for (const [dc, dr] of dirs) {
        const cells: Array<readonly [number, number]> = [];
        for (let s = 0; s < 4; s++) {
          const c = col + dc * s;
          const r = row + dr * s;
          if (c < 0 || c >= COLS || r < 0 || r >= ROWS) break;
          cells.push([c, r]);
        }
        if (cells.length === 4) out.push(cells);
      }
    }
  }
  return out;
})();

/**
 * How good this position looks for `me`, ignoring anything a search would find.
 *
 * Counts each four-cell window: a window with three of mine and a gap is worth
 * a lot, one contested by both is worth nothing.
 */
function evaluate(board: Board, me: Person): number {
  const them = other(me);
  let score = 0;

  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      if (at(board, col, row) === me) score += COLUMN_BIAS[col];
    }
  }

  for (const window of WINDOWS) {
    let mine = 0;
    let theirs = 0;
    for (const [c, r] of window) {
      const cell = at(board, c, r);
      if (cell === me) mine++;
      else if (cell === them) theirs++;
    }
    if (mine > 0 && theirs > 0) continue; // contested, worth nothing to either
    if (mine === 3) score += 60;
    else if (mine === 2) score += 8;
    if (theirs === 3) score -= 80; // block sooner than you build
    else if (theirs === 2) score -= 8;
  }

  return score;
}

/** Search the middle first: it prunes far harder. */
function ordered(moves: number[]): number[] {
  const centre = (COLS - 1) / 2;
  return moves.slice().sort((a, b) => Math.abs(a - centre) - Math.abs(b - centre));
}

type Search = { deadline: number; ranOut: boolean };

/**
 * Negamax with alpha-beta. The score is always from the point of view of the
 * side to move, which is the whole trick: one perspective, negated on the way
 * back up, instead of two that can drift apart.
 */
function negamax(
  board: Board,
  toMove: Person,
  depth: number,
  alpha: number,
  beta: number,
  search: Search,
): number {
  const win = findWin(board);
  if (win) {
    // Whoever just moved is the one who made it, so a win on the board is a
    // loss for the side now to move. Depth in the score prefers a quick win
    // and a slow loss.
    return win.who === toMove ? WIN_SCORE + depth : -(WIN_SCORE + depth);
  }
  if (isFull(board)) return 0;
  if (depth === 0) return evaluate(board, toMove);

  if (performance.now() > search.deadline) {
    search.ranOut = true;
    return evaluate(board, toMove);
  }

  let best = -Infinity;
  for (const col of ordered(legalMoves(board))) {
    const next = drop(board, col, toMove);
    if (!next) continue;
    const score = -negamax(next, other(toMove), depth - 1, -beta, -alpha, search);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break; // the opponent would never let us get here
  }
  return best;
}

/**
 * The move the machine plays.
 *
 * Iterative deepening inside a time budget: each depth completes or the clock
 * stops it, and the deepest completed result is the one used. `rand` is
 * injectable so a test can pin the tie-break.
 */
export function bestMove(
  board: Board,
  me: Person,
  level: Level = 'proper',
  rand: () => number = Math.random,
): number {
  const moves = legalMoves(board);
  if (moves.length === 0) return -1;

  // Take a win, and refuse a loss, without spending the budget on either.
  for (const col of moves) {
    const next = drop(board, col, me);
    if (next && findWin(next)?.who === me) return col;
  }
  const them = other(me);
  for (const col of moves) {
    const next = drop(board, col, them);
    if (next && findWin(next)?.who === them) return col;
  }

  // Easy plays a reasonable move but not always the best one, so it is beatable
  // without being obviously stupid.
  if (level === 'easy' && rand() < 0.35) {
    return ordered(moves)[Math.floor(rand() * Math.min(3, moves.length))];
  }

  const deadline = performance.now() + BUDGET_MS[level];
  let chosen = ordered(moves)[0];

  for (let depth = 2; depth <= MAX_DEPTH[level]; depth++) {
    const search: Search = { deadline, ranOut: false };
    let best = -Infinity;
    let bestCol = chosen;

    let alpha = -Infinity;
    for (const col of ordered(moves)) {
      const next = drop(board, col, me);
      if (!next) continue;
      // After my move it is their turn, and negamax answers from their side.
      const score = -negamax(next, them, depth - 1, -Infinity, -alpha, search);
      if (score > best) {
        best = score;
        bestCol = col;
        alpha = score;
      }
    }

    // A depth cut short mid-way has compared apples to oranges; keep the last
    // depth that finished.
    if (search.ranOut) break;
    chosen = bestCol;
    if (best >= WIN_SCORE) break;
  }

  return chosen;
}
