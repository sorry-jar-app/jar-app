'use client';

/**
 * The other phone.
 *
 * Supabase Realtime broadcast plus presence, on a channel of its own. Not the
 * store's `jar:<id>` channel: adding bindings there would tear down its four
 * postgres_changes subscriptions every time a game mounts. supabase-js
 * multiplexes channels over one socket, so this is a second topic, not a second
 * connection.
 *
 * A note on privacy, deliberately: broadcast is only RLS-protected when the
 * channel is created `private: true`, which needs policies on
 * realtime.messages that this project does not have. The payload is a column
 * number, and reaching it requires a jar uuid that only appears inside an
 * authenticated session, so it ships open. Closing it later is one policy using
 * the existing is_jar_member().
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';
import { newId } from '@/lib/id';
import { isGameMsg, type GameMsg, type OpponentSource } from './opponent';

const EVENT = 'four';

export function useRemoteOpponent(
  jarId: string | null,
  meId: string | null,
  partnerId: string | null,
  name: string,
): OpponentSource {
  const listeners = useRef(new Set<(msg: GameMsg) => void>());
  const channel = useRef<RealtimeChannel | null>(null);
  const subscribed = useRef(false);
  const [present, setPresent] = useState(false);

  /**
   * Per-mount, not the user id. Keyed on the user, the same person signed in on
   * a phone and a laptop collapses into one presence key and the game decides
   * their partner has arrived.
   */
  const sessionId = useRef(newId()).current;

  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !jarId) return;

    const ch = sb.channel(`game:${jarId}`, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: sessionId, enabled: true },
      },
    });

    const readPresence = () => {
      if (!partnerId) {
        setPresent(false);
        return;
      }
      const state = ch.presenceState<{ userId?: string }>();
      const here = Object.values(state)
        .flat()
        .some((meta) => meta.userId === partnerId);
      setPresent(here);
    };

    ch.on('presence', { event: 'sync' }, readPresence)
      .on('presence', { event: 'join' }, readPresence)
      .on('presence', { event: 'leave' }, readPresence)
      .on('broadcast', { event: EVENT }, ({ payload }) => {
        // Broadcast payloads are untyped and come off the wire; anything that
        // is not a message we recognise is dropped without comment.
        if (!isGameMsg(payload)) return;
        if (payload.from === sessionId) return;
        for (const on of listeners.current) on(payload);
      })
      .subscribe((status) => {
        subscribed.current = status === 'SUBSCRIBED';
        // Announce who I am, so the other phone can recognise me as its
        // partner rather than as some third presence.
        if (status === 'SUBSCRIBED') void ch.track({ userId: meId });
      });

    channel.current = ch;
    return () => {
      subscribed.current = false;
      channel.current = null;
      void sb.removeChannel(ch);
    };
    // sessionId is a ref-held constant.
  }, [jarId, meId, partnerId, sessionId]);

  const send = useCallback(
    (msg: GameMsg) => {
      const ch = channel.current;
      // send() silently falls back to an HTTP POST when the socket cannot
      // push, which is a REST round trip pretending to be realtime. Drop it.
      if (!ch || !subscribed.current) return;
      void ch.send({ type: 'broadcast', event: EVENT, payload: { ...msg, from: sessionId } });
    },
    [sessionId],
  );

  const subscribe = useCallback((on: (msg: GameMsg) => void) => {
    listeners.current.add(on);
    return () => {
      listeners.current.delete(on);
    };
  }, []);

  return useMemo(
    () => ({ kind: 'remote' as const, present, name, send, subscribe }),
    [present, name, send, subscribe],
  );
}
