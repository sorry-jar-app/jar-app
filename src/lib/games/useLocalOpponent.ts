'use client';

/**
 * The person sitting next to you.
 *
 * There is no channel and nothing to wait for: a move made on this device is
 * simply announced to the same device. Asynchronous anyway, via a microtask, so
 * the state machine behaves identically to the remote case rather than having a
 * second, subtly different code path to debug.
 */

import { useCallback, useMemo, useRef } from 'react';
import type { GameMsg, OpponentSource } from './opponent';

export function useLocalOpponent(name: string): OpponentSource {
  const listeners = useRef(new Set<(msg: GameMsg) => void>());

  const send = useCallback((msg: GameMsg) => {
    // Only the opponent's own moves come back; the caller already applied its
    // own. The screen marks a message as theirs by sending it on their behalf.
    queueMicrotask(() => {
      for (const on of listeners.current) on(msg);
    });
  }, []);

  const subscribe = useCallback((on: (msg: GameMsg) => void) => {
    listeners.current.add(on);
    return () => {
      listeners.current.delete(on);
    };
  }, []);

  return useMemo(
    () => ({ kind: 'local' as const, present: true, name, send, subscribe }),
    [name, send, subscribe],
  );
}
