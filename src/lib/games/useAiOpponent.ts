'use client';

/**
 * The machine, for when the other one is not around.
 *
 * Answers on a short timer rather than instantly — an opponent that replies in
 * the same frame reads as a bug, not as a player. The search itself is
 * time-boxed in the solver, so a slow phone gets a shallower move and never a
 * dropped frame.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { bestMove, type Level } from './four/solver';
import type { Board } from './four/board';
import type { GameMsg, OpponentSource } from './opponent';
import type { Person } from '@/lib/types';

/** Long enough to read as consideration, short enough not to feel slow. */
const THINK_MS = { easy: 450, proper: 700 } as const;

export function useAiOpponent(name: string, level: Level = 'proper'): OpponentSource {
  const listeners = useRef(new Set<(msg: GameMsg) => void>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const round = useRef('ai');

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const send = useCallback((msg: GameMsg) => {
    // The machine only listens for the round id; it has no use for the rest.
    if (msg.t === 'newRound' || msg.t === 'move') round.current = msg.round;
  }, []);

  const subscribe = useCallback((on: (msg: GameMsg) => void) => {
    listeners.current.add(on);
    return () => {
      listeners.current.delete(on);
    };
  }, []);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const think = useCallback(
    (board: unknown, as: Person) => {
      if (timer.current) clearTimeout(timer.current);
      // Stamped here, at schedule time, and NOT read from the ref when the
      // timer fires. Starting a new round sends us a newRound, which moves
      // round.current — so a search still running from the abandoned position
      // would come back wearing the new round's id, sail through the screen's
      // staleness guard, and drop a disc on a fresh board in the human's own
      // colour, in a column they never touched.
      const forRound = round.current;
      timer.current = setTimeout(() => {
        timer.current = null;
        const col = bestMove(board as Board, as, level);
        if (col < 0) return;
        const msg: GameMsg = { t: 'move', from: 'ai', round: forRound, col };
        for (const on of listeners.current) on(msg);
      }, THINK_MS[level]);
    },
    [level],
  );

  return useMemo(
    () => ({ kind: 'ai' as const, present: true, name, send, subscribe, think, cancel }),
    [name, send, subscribe, think, cancel],
  );
}
