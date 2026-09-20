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
 * The controls are the kit's, dressed by the kit: `variant` and `size` say
 * what a button is for and the theme decides what that looks like. Nothing on
 * this screen paints a HeroUI component or pins its height, and the glyphs are
 * sized by .button rather than by hand. The only inline styles left are the
 * frame the screen is built on.
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
        <span className="sj-title">Digi Jar</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <Button
            variant="ghost"
            isIconOnly
            aria-label="Notifications"
            onPress={() => router.push('/notifications')}
          >
            <BellIcon />
          </Button>
          <Button
            variant="ghost"
            isIconOnly
            aria-label="Settings"
            onPress={() => router.push('/settings')}
          >
            <GearIcon />
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

        <div className="sj-money" style={{ marginTop: 6 }}>
          {veil(total, sealed)}
        </div>

        <div className="text-muted text-sm">
          {sealed
            ? `${state.fines.length} fines in, total sealed`
            : `${state.fines.length} fines since ${started}`}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {/* The only read of `mystery` rather than `sealed`: the button stays
              put mid-reveal, it just changes its label. */}
          {state.mystery && (
            <Button variant="ghost" size="sm" onPress={peek}>
              <EyeIcon />
              {peeking ? 'Hiding again…' : 'Peek'}
            </Button>
          )}
          <Button variant="ghost" size="sm" onPress={() => router.push('/games')}>
            Games
          </Button>
          <Button variant="ghost" size="sm" onPress={() => router.push('/cash-out')}>
            Spend the jar →
          </Button>
        </div>
      </div>

      <div
        style={{ padding: '0 24px 6px', display: 'flex', flexDirection: 'column', gap: 9 }}
      >
        <div className="text-sm" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>
            <strong>{state.me}</strong> <span className="text-muted">{veil(meTotal, sealed)}</span>
          </span>
          <span>
            <span className="text-muted">{veil(partnerTotal, sealed)}</span>{' '}
            <strong>{state.partner}</strong>
          </span>
        </div>
        {/*
          The split bar is one quantity in a known range — A's share of the jar
          — so it is a Meter, and the track behind the fill is S's share by
          construction. Two divs said the same thing to the eye and nothing at
          all to a screen reader; this says it to both.

          Both halves are painted, and neither comes from a theme semantic.
          --who-a and --who-s are the two people, and the kit has no prop for
          "the empty half means someone too". Taking the fill from `color`
          instead would hand A whatever --accent happens to be — near-white in
          dark mode, which puts a blank bar where a person should be.

          Sealed, the bar drops to the kit's neutral and is forced to an even
          50/50. The 50 is a decoy, so `valueLabel` speaks instead of it: a
          screen reader hears "sealed" where it would otherwise hear a number
          that is not true. Masking that holds for the eye and leaks to the ear
          is not masking.
        */}
        <Meter
          aria-label={`${state.me}'s share of the jar`}
          size="lg"
          color={sealed ? 'default' : undefined}
          value={sealed ? 50 : meShare}
          // 50 is the visual default for "nothing to split" and must stay, or
          // the bar goes lopsided on an empty jar. But the old markup was two
          // anonymous divs that said nothing; a Meter turns the same 50 into an
          // assertion, and "Nick's share of the jar, 50 percent" directly
          // contradicts the "0 fines since ..." line above it.
          valueLabel={sealed ? 'sealed' : total ? undefined : 'Nothing in the jar'}
        >
          <Meter.Track style={sealed ? undefined : { background: 'var(--who-s)' }}>
            <Meter.Fill style={sealed ? undefined : { background: 'var(--who-a)' }} />
          </Meter.Track>
        </Meter>
      </div>

      <div style={{ padding: '14px 24px 0' }}>
        <Button size="lg" fullWidth onPress={() => router.push('/log')}>
          <PlusIcon />
          Log a fine
        </Button>
      </div>
    </div>
  );
}
