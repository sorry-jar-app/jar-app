'use client';

/**
 * Pairing — get the second person in, from either side.
 *
 * One frame, three states: the seed demo, a real jar still waiting on its
 * second person, and a jar that already has one. The jar exists from the moment
 * this screen is reached, so every action here marks the user onboarded; solo
 * use before the partner joins is supported.
 *
 * The code box is also the only place an invitee can type a code by hand, so it
 * shows to a signed-out visitor too — they cannot redeem it without a session,
 * so their Join stashes the code and sends them to sign in, the same loop /join
 * runs for an invite link. Arriving with ?join=1 lifts the box above the invite
 * card: whoever came to join has no use for a code of their own yet.
 */

import { Button, Card, Chip, Input, Label, TextField } from '@heroui/react';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { INVITE_CODE, INVITE_URL } from '@/lib/constants';
import { displayName, useStore } from '@/lib/store';

const DEMO_LINK = `https://${INVITE_URL}`;
const COPIED_MS = 1600;

/** The same drop box /join uses; /auth/callback redeems it after sign-in. */
const PENDING_CODE = 'sorry-jar:pending-code';

/** The invite panel's one placement decision. The kit owns the rest of it. */
const CARD: React.CSSProperties = { marginTop: 26, textAlign: 'center' };

/** Four characters, with or without the JAR- the design prints in front. */
function looksLikeCode(entered: string): boolean {
  return /^(jar-)?[a-z0-9]{4}$/i.test(entered.trim());
}

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

function PairFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const { state, dispatch, auth, configured, joinByCode, startJar } = useStore();

  const jar = state.jar;
  const paired = Boolean(jar?.partnerId);
  const signedIn = configured && auth.userId !== null;
  // Signed in with no jar: the callback's create failed, or they landed here
  // directly. Showing the demo code here would be handing them a dead invite.
  const jarless = signedIn && !jar;
  // You can only join a jar if you are not already in one, and only if there is
  // a project to join one in — with nothing configured a code has nothing to
  // open. Signed out is fine: that is most invitees, and Join handles them.
  // Held back until auth has answered, so the button knows which of the two
  // paths it is on before anyone can press it.
  // Show the field to anyone who could plausibly use it: signed out (stash the
  // code and go sign in), or signed in without a jar (redeem it now). Only a
  // build with no Supabase at all has nothing a code could do — and in that
  // build the demo says so rather than hiding the box someone was sent to find.
  const canJoin = configured && auth.ready && jar === null;
  // Sent here by the Welcome screen's "I have an invite code".
  const leadWithCode = canJoin && params.get('join') === '1';

  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  // Reading window.location during render would not match the server pass.
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Came here to type a code: put the cursor in the box.
  useEffect(() => {
    if (leadWithCode) codeInput.current?.focus();
  }, [leadWithCode]);

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

    // No session, so nothing can be redeemed yet. Hold the code and go get one;
    // the callback picks it up on the way back. localStorage rather than
    // session storage because the emailed link often opens in a new tab.
    if (!signedIn) {
      // Reject obvious nonsense here rather than parking it in the drop box:
      // a real code is four characters, optionally prefixed JAR-.
      if (!looksLikeCode(entered)) {
        setJoinError('That is not the shape of a code. It looks like JAR-4K2P.');
        return;
      }
      setJoining(true);
      try {
        localStorage.setItem(PENDING_CODE, entered);
      } catch {
        // Private mode: nowhere to keep it, and nowhere to keep the session
        // either — the auth client stores one the same way. Carry on anyway,
        // so sign-in fails in one place rather than two.
      }
      goSignIn();
      return;
    }

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

  // One section, two homes: above the invite card for someone who arrived
  // to join, below it for someone who is idly passing through.
  const codeSection = canJoin ? (
    <div className="sj-section" style={{ marginTop: 22 }}>
      <h6 className="sj-label">Came here with a code?</h6>
      <div style={{ display: 'flex', gap: 9, alignItems: 'flex-end' }}>
        {/* `id` on the TextField, not the Input: it is the id the generated
            <label for> is written against. */}
        <TextField
          id="pair-code"
          style={{ flex: 1 }}
          value={code}
          isInvalid={joinError !== null}
          onChange={(next) => {
            setCode(next);
            if (joinError) setJoinError(null);
          }}
        >
          <Label>Their invite code</Label>
          <Input
            ref={codeInput}
            placeholder="JAR-4K2P"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void join();
            }}
          />
        </TextField>
        {/* aria-disabled, not isDisabled: this is the button you press, and a
            real `disabled` drops focus the instant it turns into "Joining…".
            join() already refuses an empty code and a second press. */}
        <Button
          variant="secondary"
          onPress={() => void join()}
          aria-disabled={joining || code.trim().length === 0}
          aria-busy={joining}
        >
          {joining ? 'Joining…' : 'Join'}
        </Button>
      </div>
      {joinError && (
        // Left as a live region. HeroUI's FieldError is wired to the input by
        // aria-describedby, but React Aria strips role from it, and focus is on
        // the Join button when this arrives — nothing would be announced.
        <p role="alert" style={{ fontSize: 13, color: 'var(--danger)' }}>
          {joinError}
        </p>
      )}
    </div>
  ) : null;

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

      {leadWithCode && codeSection}

      {paired ? (
        <Card style={CARD}>
          <Card.Content>
            <div className="sj-label">Paired with</div>
            <div style={{ fontSize: 34 }}>{displayName(state, 'S')}</div>
            <div className="text-muted" style={{ fontSize: 12 }}>
              Nothing left to send.
            </div>
          </Card.Content>
        </Card>
      ) : jarless ? (
        <Card style={CARD}>
          <Card.Content>
            <div className="sj-label">No jar yet</div>
            <div className="text-muted" style={{ fontSize: 14 }}>
              Signing in worked; opening the jar did not.
            </div>
          </Card.Content>
          <Card.Footer style={{ flexDirection: 'column', gap: 10 }}>
            <Button
              fullWidth
              aria-disabled={opening}
              aria-busy={opening}
              onPress={() => void open()}
            >
              {opening ? 'Opening…' : 'Try again'}
            </Button>
            {openError && (
              <p role="alert" style={{ fontSize: 13, margin: 0, color: 'var(--danger)' }}>
                {openError}
              </p>
            )}
          </Card.Footer>
        </Card>
      ) : (
        <Card style={CARD}>
          <Card.Content>
            <div className="sj-label">Your code</div>
            <div style={{ fontSize: 38, letterSpacing: '0.06em' }}>
              {jar ? `JAR-${jar.inviteCode}` : INVITE_CODE}
            </div>
            <div className="text-muted" style={{ fontSize: 12 }}>
              {/* The real link is only known on the client; hold the line's height. */}
              {bare(link) || '\u00A0'}
            </div>
          </Card.Content>

          <Card.Footer style={{ gap: 9 }}>
            {/* The label stays put so the button keeps its accessible name; the
                confirmation is announced separately. */}
            <Button
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => void copyLink()}
              aria-disabled={!link}
            >
              Copy link
            </Button>
            <span className="sj-visually-hidden" role="status" aria-live="polite">
              {copied ? 'Link copied' : ''}
            </span>
            <Button style={{ flex: 1 }} onPress={textIt} aria-disabled={!link}>
              Text it
            </Button>
          </Card.Footer>
        </Card>
      )}

      {!paired && (
        <div style={{ display: 'flex', marginTop: 22 }}>
          <Chip>
            <Chip.Label>
              {jar ? 'Nobody has joined yet' : `Waiting for ${displayName(state, 'S')} to join`}
            </Chip.Label>
          </Chip>
        </div>
      )}

      {!leadWithCode && codeSection}

      <div style={{ flex: 1 }} />

      {paired ? (
        <Button size="lg" fullWidth onPress={goJar}>
          Start logging
        </Button>
      ) : (
        <div className="sj-stack">
          {configured && !signedIn && (
            <Button variant="secondary" fullWidth onPress={goSignIn}>
              Get a code that actually works
            </Button>
          )}
          <Button variant="ghost" fullWidth onPress={goJar}>
            Skip for now — start logging
          </Button>
        </div>
      )}
    </div>
  );
}

export default function PairPage() {
  // useSearchParams needs a Suspense boundary to prerender under static export.
  return (
    <Suspense fallback={<div className="sj-screen sj-screen--onboarding" />}>
      <PairFlow />
    </Suspense>
  );
}
