'use client';

/**
 * Where the emailed link lands.
 *
 * The browser client is built with detectSessionInUrl, so the session is
 * already being established by the time this paints; the screen only waits for
 * it and then decides where to put the person. Client side on purpose — the
 * Capacitor build is a static export with no server to hand the code to.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Jar } from '@/components/Jar';
import { useStore } from '@/lib/store';
import { loadJar } from '@/lib/supabase/api';
import { getSupabase } from '@/lib/supabase/client';

/** How long the client gets to chew on the URL before the link is called dead. */
const GRACE_MS = 2500;

/** Set by /join when someone follows an invite before signing in. */
const PENDING_CODE = 'sorry-jar:pending-code';

/**
 * Read without consuming. A mail client usually opens the link in a fresh tab,
 * so this has to be localStorage rather than sessionStorage — and the code is
 * only cleared once it has actually been redeemed, so a dropped connection
 * does not destroy the one copy the app has.
 */
function peekPendingCode(): string | null {
  try {
    return localStorage.getItem(PENDING_CODE);
  } catch {
    return null; // Private mode. They can type the code on the pairing screen.
  }
}

/** Reasons that will never succeed on a retry, however many times it is tried. */
function isFinalRefusal(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('no jar with that code') ||
    m.includes('already a pair') ||
    m.includes('already in a jar')
  );
}

function clearPendingCode(): void {
  try {
    localStorage.removeItem(PENDING_CODE);
  } catch {
    /* nothing to clear */
  }
}

type Snag = { line: string; action: string };

export default function AuthCallbackPage() {
  const router = useRouter();
  const { auth, state, startJar, joinByCode } = useStore();

  const [snag, setSnag] = useState<Snag | null>(null);
  const [refused, setRefused] = useState(false);
  const [waited, setWaited] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    // A dead link comes back with its reason in the URL, and that answer is
    // immediate — no reason to sit through the grace period for it.
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const problem =
      query.get('error_description') ??
      query.get('error') ??
      hash.get('error_description') ??
      hash.get('error');

    if (problem) {
      console.warn('[sorry jar] sign-in link rejected:', problem);
      setRefused(true);
    }

    const timer = setTimeout(() => setWaited(true), GRACE_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // This effect re-runs on every auth and jar change; one arrival, one course.
    if (handled.current || !auth.ready || !auth.userId) return;
    handled.current = true;

    const code = peekPendingCode();
    const userId = auth.userId;

    // An invite beats everything. Checking state.jar first let the store's own
    // load win the race and strand the invitee in a jar of their own, which
    // one-jar-per-person then makes permanent.
    if (!code && state.jar) {
      router.replace('/jar');
      return;
    }

    void (async () => {
      try {
        if (code) {
          const message = await joinByCode(code);
          if (message) {
            console.warn('[sorry jar] invite code refused:', message);
            // A definitive refusal must clear the code, or it is retried on
            // every future sign-in and the snag screen becomes permanent. A
            // transient failure keeps it — that copy is the only one left.
            if (isFinalRefusal(message)) clearPendingCode();
            setSnag({ line: 'That invite didn’t take.', action: 'Enter it by hand' });
            return;
          }
          clearPendingCode();
          router.replace('/jar');
          return;
        }

        const sb = getSupabase();
        // Someone signing in again already has a jar and the store's own load
        // is still in flight; create_jar would collide with it. Only decide
        // whether to create — the effect below navigates once the store has
        // hydrated, or /jar paints the seed fixtures as this person's money.
        const existing = sb ? await loadJar(sb, userId) : null;
        if (existing) return;

        const message = await startJar();
        if (message) throw new Error(message);
        router.replace('/pair');
      } catch (e) {
        console.warn('[sorry jar] could not open a jar after sign-in:', e);
        setSnag({ line: 'Signed in, but the jar wouldn’t open.', action: 'Carry on' });
      }
    })();
  }, [auth.ready, auth.userId, state.jar, startJar, joinByCode, router]);

  // The store finished loading the jar we decided to keep: now it is safe to
  // show /jar, with real money on it rather than the seed.
  useEffect(() => {
    if (handled.current && state.jar && !snag) router.replace('/jar');
  }, [state.jar, snag, router]);

  const dead = refused || (auth.ready && !auth.userId && waited);

  return (
    <div className="sj-screen sj-screen--centered">
      <Jar width={132} height={165} coins={3} showLidShade={false} showHighlight={false} />

      {snag ? (
        <>
          <p
            role="alert"
            style={{ fontSize: 15, marginTop: 18, maxWidth: 260, color: 'var(--color-accent-700)' }}
          >
            {snag.line}
          </p>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ marginTop: 6 }}
            onClick={() => router.replace('/pair')}
          >
            {snag.action}
          </button>
        </>
      ) : dead ? (
        <>
          <p className="text-muted" style={{ fontSize: 15, marginTop: 18, maxWidth: 260 }}>
            That link has gone stale.
          </p>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ marginTop: 6 }}
            onClick={() => router.replace('/signin')}
          >
            Send a new one
          </button>
        </>
      ) : (
        <p className="text-muted" style={{ fontSize: 15, marginTop: 18 }}>
          Getting the lid off&hellip;
        </p>
      )}
    </div>
  );
}
