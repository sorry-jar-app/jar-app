'use client';

/**
 * One seam, three opponents.
 *
 * Four in a row can be played against the other phone, against the person
 * sitting next to you, or against the machine when nobody is around. The board,
 * the turn logic, the result and the hand-off to /log are identical in all
 * three; only where the other move comes from differs.
 *
 * Turn-based, which spares this a great deal of grief: there is no clock to
 * synchronise and no dead heat to arbitrate. A move is a column number, and the
 * board is the only state either side needs.
 */

import type { Person } from '@/lib/types';

/** The wire format. `round` lets a late message from a finished game be dropped. */
export type GameMsg =
  | { t: 'hello'; from: string; user: string }
  | { t: 'newRound'; from: string; round: string; starter: Person }
  | { t: 'move'; from: string; round: string; col: number }
  | { t: 'bail'; from: string; round: string; why: 'left' | 'declined' };

export type OpponentKind = 'remote' | 'local' | 'ai';

export type OpponentSource = {
  readonly kind: OpponentKind;
  /** Is there anybody there? Always true for local and ai. */
  readonly present: boolean;
  /** What to call them on screen. */
  readonly name: string;
  /** Tell the opponent something. A dropped send is not an error. */
  send(msg: GameMsg): void;
  /** Hear from the opponent. Returns an unsubscribe. */
  subscribe(on: (msg: GameMsg) => void): () => void;
  /**
   * Only the AI needs this: it is handed the board after the human moves and
   * answers in its own time. The other two get their move over the wire or
   * from a thumb, so they ignore it.
   */
  think?(board: unknown, as: Person): void;
  /**
   * Abandon a move in progress. Only the AI has one to abandon.
   *
   * A search left running across a round boundary comes back holding a column
   * for a board that no longer exists.
   */
  cancel?(): void;
};

/** Narrow an untrusted broadcast payload. Anything else is dropped in silence. */
export function isGameMsg(value: unknown): value is GameMsg {
  if (!value || typeof value !== 'object') return false;
  const m = value as Record<string, unknown>;
  if (typeof m.from !== 'string') return false;

  switch (m.t) {
    case 'hello':
      return typeof m.user === 'string';
    case 'newRound':
      return typeof m.round === 'string' && (m.starter === 'A' || m.starter === 'S');
    case 'move':
      return (
        typeof m.round === 'string' &&
        typeof m.col === 'number' &&
        Number.isInteger(m.col) &&
        m.col >= 0 &&
        m.col < 7
      );
    case 'bail':
      return typeof m.round === 'string' && (m.why === 'left' || m.why === 'declined');
    default:
      return false;
  }
}
