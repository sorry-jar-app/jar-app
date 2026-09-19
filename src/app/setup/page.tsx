'use client';

/**
 * Names — the first thing the demo asks for.
 *
 * Not in the handoff: the prototype hard-coded Alex and Sam and left renaming
 * to Settings. But the whole point of the jar is that it is the two of you, and
 * the demo reads as someone else's until the names are yours. Sits between
 * Welcome and Pairing, in the Pairing screen's left-aligned frame.
 *
 * Blank is allowed and falls back to the seed names, so nobody is trapped
 * behind a form on the way into a demo.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_ME, DEFAULT_PARTNER } from '@/lib/constants';
import { useStore } from '@/lib/store';

export default function SetupPage() {
  const router = useRouter();
  const { dispatch } = useStore();

  const [me, setMe] = useState('');
  const [partner, setPartner] = useState('');

  const go = () => {
    dispatch({ type: 'setName', person: 'A', name: me.trim() || DEFAULT_ME });
    dispatch({ type: 'setName', person: 'S', name: partner.trim() || DEFAULT_PARTNER });
    router.push('/pair');
  };

  return (
    <div className="sj-screen sj-screen--onboarding" style={{ display: 'flex' }}>
      <h2 style={{ fontSize: 30, marginBottom: 8 }}>
        Who&rsquo;s in
        <br />
        this jar?
      </h2>
      <p className="text-muted" style={{ fontSize: 14, maxWidth: 280 }}>
        Both names show up on every fine. You can change them later.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 26 }}>
        <div className="field">
          <label htmlFor="setup-me">You</label>
          <input
            id="setup-me"
            className="input"
            style={{ height: 44 }}
            value={me}
            placeholder={DEFAULT_ME}
            autoComplete="given-name"
            autoFocus
            onChange={(e) => setMe(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="setup-partner">Them</label>
          <input
            id="setup-partner"
            className="input"
            style={{ height: 44 }}
            value={partner}
            placeholder={DEFAULT_PARTNER}
            autoComplete="off"
            onChange={(e) => setPartner(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') go();
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <button
        type="button"
        className="btn btn-primary btn-block"
        style={{ height: 54, fontSize: 17, marginTop: 0 }}
        onClick={go}
      >
        Next
      </button>
    </div>
  );
}
