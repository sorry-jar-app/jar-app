'use client';

/**
 * Where an invite link lands.
 *
 * The handoff's link shape is sorryjar.app/j/<code>, but a path segment cannot
 * be a route under `output: 'export'` — the Capacitor build would have to know
 * every code at build time. So the real page is this one, reading the code
 * from the query string, and next.config rewrites /j/:code onto it for the
 * pretty URL on the web. Both builds get a page that works.
 */

import { Button } from '@heroui/react';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Jar } from '@/components/Jar';
import { useStore } from '@/lib/store';

/* HeroUI's .button is h-10 / h-9 above 768px, and .btn sets no height of its
   own, so a button the design sizes by its padding needs height:auto back. */
const GHOST: React.CSSProperties = { marginTop: 6, height: 'auto' };

function JoinFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const { auth, joinByCode, dispatch, state } = useStore();

  const code = (params.get('c') ?? '').trim();
  const [error, setError] = useState<string | null>(null);
  const tried = useRef(false);

  useEffect(() => {
    if (!auth.ready || !code || tried.current) return;

    // Not signed in yet: hold the code and send them to sign in first, so the
    // link still works when they come back through the callback.
    if (!auth.userId) {
      try {
        // localStorage, not session: the magic link usually opens in a new tab
        // and sessionStorage would not be there when it does.
        localStorage.setItem('sorry-jar:pending-code', code);
      } catch {
        /* Private mode. They can still type the code on the pairing screen. */
      }
      router.replace('/signin');
      return;
    }

    tried.current = true;
    dispatch({ type: 'setOnboarded' });
    void joinByCode(code).then((message) => {
      if (message) setError(message);
      else router.replace('/jar');
    });
  }, [auth.ready, auth.userId, code, joinByCode, router, dispatch]);

  const missing = auth.ready && !code;

  return (
    <div className="sj-screen sj-screen--centered">
      <Jar width={140} height={175} coins={state.coins} showLidShade={false} />

      {missing ? (
        <>
          <p className="text-muted" style={{ fontSize: 15, marginTop: 18, maxWidth: 260 }}>
            That link is missing its code.
          </p>
          <Button
            className="btn btn-ghost"
            variant="ghost"
            style={GHOST}
            onPress={() => router.replace('/pair')}
          >
            Enter it by hand
          </Button>
        </>
      ) : error ? (
        <>
          {/* Kept as a live region rather than moved into a HeroUI Alert: the
              error arrives with focus nowhere near it, and React Aria strips
              role from its own message slots. */}
          <p
            role="alert"
            style={{ fontSize: 15, marginTop: 18, maxWidth: 260, color: 'var(--color-accent-700)' }}
          >
            {error}
          </p>
          <Button
            className="btn btn-ghost"
            variant="ghost"
            style={GHOST}
            onPress={() => router.replace('/pair')}
          >
            Try another code
          </Button>
        </>
      ) : (
        <p className="text-muted" style={{ fontSize: 15, marginTop: 18 }}>
          Letting you in&hellip;
        </p>
      )}
    </div>
  );
}

export default function JoinPage() {
  // useSearchParams needs a Suspense boundary to prerender under static export.
  return (
    <Suspense fallback={<div className="sj-screen sj-screen--centered" />}>
      <JoinFlow />
    </Suspense>
  );
}
