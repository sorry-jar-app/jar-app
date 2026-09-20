'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Meter } from '@heroui/react';
import { Jar } from '@/components/Jar';
import { BellIcon, EyeIcon, GearIcon, PlusIcon } from '@/components/Icons';
import { JAR_STARTED } from '@/lib/constants';
import { formatStarted } from '@/lib/when';
import { veil } from '@/lib/money';
import { sumFines, useStore } from '@/lib/store';
import { useShake } from '@/lib/useShake';
import { useTilt } from '@/lib/useTilt';

/**
 * Home — the jar, the ledger, and the one button that matters.
 *
 * Everything with a figure on it goes through `veil`, and the split bar is
 * forced to an even 50/50 while sealed: the ratio alone would give the total
 * away. The tab bar comes from AppShell.
 *
 * Shake the phone and the coins tumble. It is a toy, not a feature: no fine is
 * logged, no total changes. Tapping the jar does the same thing, which gives
 * it a discoverable, permission-free path on every platform and doubles as the
 * user gesture iOS insists on before it will hand over motion events.
 *
 * The controls are HeroUI's, wearing the app's .btn classes. Those classes
 * load after HeroUI's stylesheet and win at equal specificity, so the geometry
 * is the one Organic specifies and HeroUI supplies the behaviour: onPress,
 * which cancels cleanly when a press turns into a scroll. Two places need an
 * inline override because HeroUI outranks a single class there — .button sizes
 * its own svg children, and it pins a height the ghost row does not want.
 *
 * The jar itself stays a plain button. It is the artwork, not a control.
 */
export default function HomePage() {
  const router = useRouter();
  const { state, sealed, peeking, peek } = useStore();

  const total = sumFines(state.fines);
  const meTotal = sumFines(state.fines, 'A');
  const partnerTotal = sumFines(state.fines, 'S');
  const meShare = total ? Math.round((meTotal / total) * 100) : 50;

  // A real jar knows when it started; the constant is the demo's.
  const started = state.startedOn ? formatStarted(state.startedOn) : JAR_STARTED;

  const [tumbleKey, setTumbleKey] = useState(0);
  const tumble = useCallback(() => setTumbleKey((n) => n + 1), []);
  const { requestAccess } = useShake(tumble);
  // Tilt the phone and the coins slide. The pile is allowed to fall asleep, so
  // `nudge` is what rouses it — the loop would otherwise never see the new
  // gravity, and leaving it running would sit on the battery.
  const { gravity, requestAccess: askTilt, nudge } = useTilt();

  const tapJar = useCallback(() => {
    // A click is a user gesture, which is the only moment iOS will let us ask
    // for motion or orientation. Harmless no-op everywhere else.
    requestAccess();
    askTilt();
    tumble();
  }, [requestAccess, askTilt, tumble]);

  return (
    <div className="sj-screen sj-screen--tabbed">
      <div className="sj-header sj-header--home">
        <span className="sj-title">Sorry Jar</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <Button
            className="btn btn-icon btn-secondary"
            variant="ghost"
            isIconOnly
            aria-label="Notifications"
            onPress={() => router.push('/notifications')}
          >
            {/* .button sizes its own svg children at 20px, and 16px above 640.
                The glyph is 17px here, as it is everywhere else in the app. */}
            <BellIcon style={{ width: 17, height: 17, margin: 0 }} />
          </Button>
          <Button
            className="btn btn-icon btn-secondary"
            variant="ghost"
            isIconOnly
            aria-label="Settings"
            onPress={() => router.push('/settings')}
          >
            <GearIcon style={{ width: 17, height: 17, margin: 0 }} />
          </Button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          padding: '0 24px',
          minHeight: 0,
        }}
      >
        <button
          type="button"
          className="sj-jar-tap"
          aria-label="Shake the jar"
          onClick={tapJar}
        >
          <Jar
            width={206}
            height={258}
            coins={state.coins}
            tumbleKey={tumbleKey}
            gravity={gravity}
            wakeKey={nudge}
          />
        </button>

        <div
          className="sj-money"
          style={{ fontSize: 52, lineHeight: 1, letterSpacing: '-0.02em', marginTop: 6 }}
        >
          {veil(total, sealed)}
        </div>

        <div className="text-muted" style={{ fontSize: 13 }}>
          {sealed
            ? `${state.fines.length} fines in, total sealed`
            : `${state.fines.length} fines since ${started}`}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {/* The only read of `mystery` rather than `sealed`: the button stays
              put mid-reveal, it just changes its label. */}
          {state.mystery && (
            <Button
              className="btn btn-ghost"
              variant="ghost"
              // .button is h-10, and h-9 on a viewport past 768 — which fires
              // on a desktop even though the frame is 430px wide. These are
              // text links; the padding sizes them.
              style={{ fontSize: 13, gap: 7, height: 'auto' }}
              onPress={peek}
            >
              <EyeIcon style={{ width: 15, height: 15, margin: 0 }} />
              {peeking ? 'Hiding again…' : 'Peek'}
            </Button>
          )}
          <Button
            className="btn btn-ghost"
            variant="ghost"
            style={{ fontSize: 13, height: 'auto' }}
            onPress={() => router.push('/games')}
          >
            Games
          </Button>
          <Button
            className="btn btn-ghost"
            variant="ghost"
            style={{ fontSize: 13, height: 'auto' }}
            onPress={() => router.push('/cash-out')}
          >
            Spend the jar →
          </Button>
        </div>
      </div>

      <div
        style={{ padding: '0 24px 6px', display: 'flex', flexDirection: 'column', gap: 9 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span>
            <strong style={{ fontWeight: 700 }}>{state.me}</strong>{' '}
            <span className="text-muted">{veil(meTotal, sealed)}</span>
          </span>
          <span>
            <span className="text-muted">{veil(partnerTotal, sealed)}</span>{' '}
            <strong style={{ fontWeight: 700 }}>{state.partner}</strong>
          </span>
        </div>
        {/*
          The split bar is one quantity in a known range — A's share of the jar
          — so it is a Meter, and the track behind the fill is S's share by
          construction. Two divs said the same thing to the eye and nothing at
          all to a screen reader; this says it to both.

          Colours are the 500 steps of each ramp. That is the contrast rule
          working as intended, not against it: nothing is written on this bar,
          so it is a non-text fill and 500 is the step for those. HeroUI's own
          --accent is the 600 step, which is why the fill is painted here.

          Sealed, the bar is forced to an even 50/50 and drops to the 300 steps.
          The 50 is a decoy, so `valueLabel` speaks instead of it: a screen
          reader hears "Sealed" where it would otherwise hear a number that is
          not true. Masking that holds for the eye and leaks to the ear is not
          masking.
        */}
        <Meter
          aria-label={`${state.me}'s share of the jar`}
          value={sealed ? 50 : meShare}
          // 50 is the visual default for "nothing to split" and must stay, or
          // the bar goes lopsided on an empty jar. But the old markup was two
          // anonymous divs that said nothing; a Meter turns the same 50 into an
          // assertion, and "Nick's share of the jar, 50 percent" directly
          // contradicts the "0 fines since ..." line above it.
          valueLabel={sealed ? 'sealed' : total ? undefined : 'Nothing in the jar'}
          // .meter is a two-row grid, label over track, with a 4px gap it does
          // not need here — there is no label row to separate.
          style={{ gap: 0 }}
        >
          <Meter.Track
            style={{
              height: 12,
              borderRadius: 999,
              background: sealed ? 'var(--color-accent-2-300)' : 'var(--color-accent-2-500)',
            }}
          >
            {/* Square, so the two shares butt flat against each other; the
                track's own overflow clip rounds the outer ends. */}
            <Meter.Fill
              style={{
                borderRadius: 0,
                background: sealed ? 'var(--color-accent-300)' : 'var(--color-accent-500)',
              }}
            />
          </Meter.Track>
        </Meter>
      </div>

      <div style={{ padding: '14px 24px 0' }}>
        <Button
          className="btn btn-primary btn-block"
          variant="primary"
          fullWidth
          style={{ height: 56, fontSize: 17, gap: 9, marginTop: 0 }}
          onPress={() => router.push('/log')}
        >
          <PlusIcon style={{ width: 19, height: 19, margin: 0 }} />
          Log a fine
        </Button>
      </div>
    </div>
  );
}
