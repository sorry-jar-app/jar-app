'use client';

/**
 * Sign in — one emailed link, and nothing else.
 *
 * No password means nothing to reset, nothing to store and no second field to
 * get wrong. The screen is a side road off pairing: turn back at any point and
 * the jar carries on working on this phone.
 */

import { Button, Input, Label, TextField } from '@heroui/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useStore } from '@/lib/store';
import { getSupabase } from '@/lib/supabase/client';

/** Loose on purpose. The real test of an address is whether the link arrives. */
const PLAUSIBLE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Supabase writes for developers. Nobody signing in should have to read
 * "For security purposes, you can only request this after 47 seconds."
 */
function readable(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('security purposes') || s.includes('rate limit') || s.includes('too many')) {
    return 'One just went out. Give it a minute before asking for another.';
  }
  if (s.includes('invalid') && s.includes('email')) {
    return 'That address came back invalid. Give it another look.';
  }
  if (s.includes('signups') || s.includes('not allowed') || s.includes('disabled')) {
    return 'That address cannot sign in.';
  }
  return 'The link did not send. Try again in a moment.';
}

/**
 * Where the emailed link should come back to.
 *
 * Not window.location.origin: under Capacitor that is capacitor://localhost,
 * which no mail client can open and Supabase will not allow-list. Set
 * NEXT_PUBLIC_SITE_URL to the public origin for any build that is not the web
 * app itself.
 */
function callbackUrl(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
  return `${base.replace(/\/$/, '')}/auth/callback`;
}

export default function SignInPage() {
  const router = useRouter();
  // `configured` rather than getSupabase() at render time: the client is null
  // during the server pass, and gating the screen on it would hydrate into a
  // different one.
  const { configured } = useStore();

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const address = email.trim();
  const sendable = PLAUSIBLE.test(address) && !sending;

  const send = async () => {
    const sb = getSupabase();
    if (!sb || !sendable) return;

    setSending(true);
    setError(null);

    try {
      const { error: refused } = await sb.auth.signInWithOtp({
        email: address,
        options: { emailRedirectTo: callbackUrl() },
      });

      if (refused) {
        // The user gets a sentence; the real reason belongs in the console.
        console.warn('[sorry jar] magic link refused:', refused.message);
        setError(readable(refused.message));
        return;
      }

      setSentTo(address);
    } catch (e) {
      // Only AuthErrors come back in `error`; storage failures and anything
      // unexpected are thrown. PKCE writes a verifier before the request, so
      // a private window lands here.
      console.warn('[sorry jar] magic link threw:', e);
      setError('The link did not send. Try again in a moment.');
    } finally {
      setSending(false);
    }
  };

  if (!configured) {
    return (
      <div className="sj-screen sj-screen--pushed">
        <ScreenHeader title="Sign in" backTo="/pair" tight />
        <div className="sj-body" style={{ padding: '16px 24px 24px' }}>
          <h2 style={{ fontSize: 24, margin: '0 0 8px' }}>Not switched on yet.</h2>
          <p className="text-muted" style={{ fontSize: 14, margin: 0, maxWidth: 300 }}>
            Signing in comes later. The jar works on this phone in the meantime.
          </p>

          <div style={{ flex: 1 }} />

          <Button
            className="btn btn-ghost btn-block"
            variant="ghost"
            style={{ height: 46 }}
            onPress={() => router.push('/pair')}
          >
            Never mind
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="sj-screen sj-screen--pushed">
      <ScreenHeader title="Sign in" backTo="/pair" tight />

      <div className="sj-body" style={{ padding: '16px 24px 24px' }}>
        {sentTo ? (
          <>
            <h2 style={{ fontSize: 24, margin: '0 0 8px' }}>Check your email.</h2>
            <p
              className="text-muted"
              role="status"
              style={{ fontSize: 14, margin: 0, maxWidth: 300, overflowWrap: 'anywhere' }}
            >
              The link went to {sentTo}. Open it on this phone.
            </p>

            <div style={{ flex: 1 }} />

            <Button
              className="btn btn-ghost btn-block"
              variant="ghost"
              style={{ height: 46 }}
              onPress={() => {
                setSentTo(null);
                setError(null);
              }}
            >
              Use a different address
            </Button>
          </>
        ) : (
          <form
            style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column' }}
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <h2 style={{ fontSize: 24, margin: '0 0 8px' }}>No password. Just a link.</h2>
            <p className="text-muted" style={{ fontSize: 14, margin: 0, maxWidth: 300 }}>
              Type your email. A link comes back — tap it on this phone and you&rsquo;re in.
            </p>

            {/* No isInvalid here: the errors this screen raises are about the
                request, not the address — "One just went out" is not a reason
                to mark the field wrong. */}
            <TextField
              className="field"
              id="signin-email"
              style={{ marginTop: 26, gap: 0 }}
              type="email"
              value={email}
              onChange={setEmail}
            >
              <Label>Email</Label>
              <Input
                style={{ height: 44 }}
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                placeholder="you@example.com"
              />
            </TextField>

            <div style={{ flex: 1 }} />

            {error ? (
              <p
                role="alert"
                style={{ fontSize: 13, margin: '0 0 10px', color: 'var(--color-accent-700)' }}
              >
                {error}
              </p>
            ) : null}

            {/* aria-disabled rather than disabled: the press that sends the
                link is the press that turns this off, and a real `disabled`
                would throw focus back to the document mid-flow. send() checks
                `sendable` itself, so a keyboard press that gets through is a
                no-op. */}
            <Button
              type="submit"
              className="btn btn-primary btn-block"
              variant="primary"
              style={{ height: 54, fontSize: 17, marginTop: 0 }}
              aria-disabled={!sendable}
              aria-busy={sending}
            >
              {sending ? 'Sending…' : 'Send the link'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
