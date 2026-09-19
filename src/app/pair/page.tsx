'use client';

/**
 * Pairing — get the second person in.
 *
 * The jar exists from the moment this screen is reached, so every action here
 * marks the user onboarded; solo use before the partner joins is supported.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { INVITE_CODE, INVITE_URL } from '@/lib/constants';
import { displayName, useStore } from '@/lib/store';

const INVITE_LINK = `https://${INVITE_URL}`;
// Just the link. Any prose here is copy the partner reads, over the user's
// name, and none has been through design.
const SMS_HREF = `sms:?&body=${encodeURIComponent(INVITE_LINK)}`;
const COPIED_MS = 1600;

export default function PairPage() {
  const router = useRouter();
  const { state, dispatch } = useStore();
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  const copyLink = useCallback(async () => {
    dispatch({ type: 'setOnboarded' });
    try {
      await navigator.clipboard.writeText(INVITE_LINK);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      setCopied(true);
      copiedTimer.current = setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      // Clipboard can reject on permission or an insecure context. The code is
      // on screen to read out, so the label simply stays put.
    }
  }, [dispatch]);

  const textIt = () => {
    dispatch({ type: 'setOnboarded' });
    window.location.href = SMS_HREF;
  };

  const skip = () => {
    dispatch({ type: 'setOnboarded' });
    router.push('/jar');
  };

  return (
    <div className="sj-screen sj-screen--onboarding">
      <h2 style={{ fontSize: 30, marginBottom: 8 }}>
        Invite your
        <br />
        other half
      </h2>

      <p className="text-muted" style={{ fontSize: 14, maxWidth: 280 }}>
        One jar, two ledgers. They&#39;ll see everything you log, and you&#39;ll see everything they
        do.
      </p>

      <div
        style={{
          marginTop: 26,
          padding: '26px 22px',
          background: 'var(--color-surface)',
          borderRadius: 32,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--color-accent-700)',
          }}
        >
          Your code
        </div>
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 38,
            letterSpacing: '0.06em',
            margin: '8px 0 2px',
          }}
        >
          {INVITE_CODE}
        </div>
        <div className="text-muted" style={{ fontSize: 12 }}>
          {INVITE_URL}
        </div>

        <div style={{ display: 'flex', gap: 9, marginTop: 20 }}>
          {/* The label stays put so the button keeps its accessible name; the
              confirmation is announced separately. */}
          <button className="btn btn-secondary" style={{ flex: 1, height: 44 }} onClick={copyLink}>
            Copy link
          </button>
          <span className="sj-visually-hidden" role="status" aria-live="polite">
            {copied ? 'Link copied' : ''}
          </span>
          <button className="btn btn-primary" style={{ flex: 1, height: 44 }} onClick={textIt}>
            Text it
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginTop: 22,
          padding: '0 4px',
        }}
      >
        <span
          className="sj-dot"
          style={{ background: 'var(--color-accent-2-500)' }}
          aria-hidden="true"
        />
        <span className="text-muted" style={{ fontSize: 13 }}>
          Waiting for {displayName(state, 'S')} to join
        </span>
      </div>

      <div style={{ flex: 1 }} />

      <button className="btn btn-ghost btn-block" style={{ height: 46 }} onClick={skip}>
        Skip for now — start logging
      </button>
    </div>
  );
}
