'use client';

/**
 * Pairing — get the second person in.
 *
 * One frame, three states: the seed demo, a real jar still waiting on its
 * second person, and a jar that already has one. The jar exists from the moment
 * this screen is reached, so every action here marks the user onboarded; solo
 * use before the partner joins is supported.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { INVITE_CODE, INVITE_URL } from '@/lib/constants';
import { displayName, useStore } from '@/lib/store';

const DEMO_LINK = `https://${INVITE_URL}`;
const COPIED_MS = 1600;

const CARD: React.CSSProperties = {
  marginTop: 26,
  padding: '26px 22px',
  background: 'var(--color-surface)',
  borderRadius: 32,
  textAlign: 'center',
};

const CARD_LABEL: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--color-accent-700)',
};

/**
 * The database raises its reasons as lowercase fragments. Say them the way the
 * rest of the app talks, and keep the original in the console.
 */
function readableJoin(raw: string): string {
  const reason = raw.toLowerCase();
  if (reason.includes('no jar with that code')) return 'No jar with that code.';
  if (reason.includes('already a pair')) return 'That jar already has two people in it.';
  if (reason.includes('already in a jar')) return 'You are already in a jar.';
  if (reason.includes('not authenticated')) return 'Signed out. Sign in and try again.';
  return 'That code did not take. Worth a second look.';
}

/** The card shows the link the way it is read out, without the scheme. */
function bare(link: string): string {
  return link.replace(/^https?:\/\//, '');
}

export default function PairPage() {
  const router = useRouter();
  const { state, dispatch, auth, configured, joinByCode, startJar } = useStore();

  const jar = state.jar;
  const paired = Boolean(jar?.partnerId);
  const signedIn = configured && auth.userId !== null;
  // Signed in with no jar: the callback's create failed, or they landed here
  // directly. Showing the demo code here would be handing them a dead invite.
  const jarless = signedIn && !jar;
  // You can only join a jar if you are not already in one. The database
  // refuses the rest (join_jar_by_code raises "you are already in a jar"), but
  // an control you cannot use should not be on screen.
  const canJoin = signedIn && jar === null;

  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reading window.location during render would not match the server pass.
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  const link = jar ? (origin ? `${origin}/j/${jar.inviteCode.toLowerCase()}` : '') : DEMO_LINK;

  const copyLink = useCallback(async () => {
    if (!link) return;
    dispatch({ type: 'setOnboarded' });
    try {
      await navigator.clipboard.writeText(link);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      setCopied(true);
      copiedTimer.current = setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      // Clipboard can reject on permission or an insecure context. The code is
      // on screen to read out, so the label simply stays put.
    }
  }, [dispatch, link]);

  const textIt = () => {
    if (!link) return;
    dispatch({ type: 'setOnboarded' });
    // Just the link. Any prose here is copy the partner reads, over the user's
    // name, and none has been through design.
    window.location.href = `sms:?&body=${encodeURIComponent(link)}`;
  };

  const goJar = () => {
    dispatch({ type: 'setOnboarded' });
    router.push('/jar');
  };

  const goSignIn = () => {
    dispatch({ type: 'setOnboarded' });
    router.push('/signin');
  };

  // Signed in but jarless — the callback's create_jar failed. Offer the retry
  // here rather than leaving them on a screen with nothing that works.
  const open = async () => {
    if (opening) return;
    setOpening(true);
    setOpenError(null);
    const problem = await startJar();
    setOpening(false);
    if (problem) setOpenError(problem);
  };

  const join = async () => {
    const entered = code.trim();
    if (!entered || joining) return;
    setJoining(true);
    setJoinError(null);
    const problem = await joinByCode(entered);
    setJoining(false);
    if (problem) {
      console.warn('[sorry jar] join refused:', problem);
      setJoinError(readableJoin(problem));
      return;
    }
    goJar();
  };

  return (
    <div className="sj-screen sj-screen--onboarding">
      <h2 style={{ fontSize: 30, marginBottom: 8 }}>
        {paired ? (
          <>
            Both of you
            <br />
            are in
          </>
        ) : (
          <>
            Invite your
            <br />
            other half
          </>
        )}
      </h2>

      <p className="text-muted" style={{ fontSize: 14, maxWidth: 280 }}>
        One jar, two ledgers. They&#39;ll see everything you log, and you&#39;ll see everything they
        do.
      </p>

      {paired ? (
        <div style={CARD}>
          <div style={CARD_LABEL}>Paired with</div>
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 34,
              margin: '8px 0 2px',
            }}
          >
            {displayName(state, 'S')}
          </div>
          <div className="text-muted" style={{ fontSize: 12 }}>
            Nothing left to send.
          </div>
        </div>
      ) : jarless ? (
        <div style={CARD}>
          <div style={CARD_LABEL}>No jar yet</div>
          <div className="text-muted" style={{ fontSize: 14, margin: '10px 0 2px' }}>
            Signing in worked; opening the jar did not.
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ height: 44, marginTop: 16, width: '100%' }}
            disabled={opening}
            aria-busy={opening}
            onClick={() => void open()}
          >
            {opening ? 'Opening…' : 'Try again'}
          </button>
          {openError && (
            <p
              role="alert"
              style={{ fontSize: 13, marginTop: 10, color: 'var(--color-accent-700)' }}
            >
              {openError}
            </p>
          )}
        </div>
      ) : (
        <div style={CARD}>
          <div style={CARD_LABEL}>Your code</div>
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 38,
              letterSpacing: '0.06em',
              margin: '8px 0 2px',
            }}
          >
            {jar ? `JAR-${jar.inviteCode}` : INVITE_CODE}
          </div>
          <div className="text-muted" style={{ fontSize: 12 }}>
            {/* The real link is only known on the client; hold the line's height. */}
            {bare(link) || ' '}
          </div>

          <div style={{ display: 'flex', gap: 9, marginTop: 20 }}>
            {/* The label stays put so the button keeps its accessible name; the
                confirmation is announced separately. */}
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1, height: 44, marginTop: 0 }}
              onClick={copyLink}
              disabled={!link}
            >
              Copy link
            </button>
            <span className="sj-visually-hidden" role="status" aria-live="polite">
              {copied ? 'Link copied' : ''}
            </span>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1, height: 44, marginTop: 0 }}
              onClick={textIt}
              disabled={!link}
            >
              Text it
            </button>
          </div>
        </div>
      )}

      {!paired && (
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
            {jar ? 'Nobody has joined yet' : `Waiting for ${displayName(state, 'S')} to join`}
          </span>
        </div>
      )}

      {canJoin && (
        <div className="sj-section" style={{ marginTop: 22 }}>
          <h6 className="sj-label">Came here with a code?</h6>
          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="pair-code">Their invite code</label>
              <input
                id="pair-code"
                className="input"
                style={{ height: 44 }}
                value={code}
                placeholder="JAR-4K2P"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (joinError) setJoinError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void join();
                }}
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ height: 44, marginTop: 0 }}
              onClick={() => void join()}
              disabled={joining || code.trim().length === 0}
              aria-busy={joining}
            >
              {joining ? 'Joining…' : 'Join'}
            </button>
          </div>
          {joinError && (
            <p role="alert" style={{ fontSize: 13, color: 'var(--color-accent-700)' }}>
              {joinError}
            </p>
          )}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {paired ? (
        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ height: 54, fontSize: 17, marginTop: 0 }}
          onClick={goJar}
        >
          Start logging
        </button>
      ) : (
        <div className="sj-stack">
          {configured && !signedIn && (
            <button
              type="button"
              className="btn btn-secondary btn-block"
              style={{ height: 46, marginTop: 0 }}
              onClick={goSignIn}
            >
              Get a code that actually works
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-block"
            style={{ height: 46, marginTop: 0 }}
            onClick={goJar}
          >
            Skip for now — start logging
          </button>
        </div>
      )}
    </div>
  );
}
