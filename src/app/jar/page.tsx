'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
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
          <button
            type="button"
            className="btn btn-icon btn-secondary"
            aria-label="Notifications"
            onClick={() => router.push('/notifications')}
          >
            <BellIcon />
          </button>
          <button
            type="button"
            className="btn btn-icon btn-secondary"
            aria-label="Settings"
            onClick={() => router.push('/settings')}
          >
            <GearIcon />
          </button>
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
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 13, gap: 7 }}
              onClick={peek}
            >
              <EyeIcon size={15} />
              {peeking ? 'Hiding again…' : 'Peek'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: 13 }}
            onClick={() => router.push('/games')}
          >
            Games
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: 13 }}
            onClick={() => router.push('/cash-out')}
          >
            Spend the jar →
          </button>
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
        <div
          style={{
            display: 'flex',
            height: 12,
            borderRadius: 999,
            overflow: 'hidden',
            background: 'var(--color-neutral-200)',
          }}
        >
          <div
            style={{
              background: sealed ? 'var(--color-accent-300)' : 'var(--color-accent-500)',
              transition: 'width .5s ease',
              width: sealed ? '50%' : `${meShare}%`,
            }}
          />
          <div
            style={{
              flex: 1,
              background: sealed ? 'var(--color-accent-2-300)' : 'var(--color-accent-2-500)',
            }}
          />
        </div>
      </div>

      <div style={{ padding: '14px 24px 0' }}>
        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ height: 56, fontSize: 17, gap: 9, marginTop: 0 }}
          onClick={() => router.push('/log')}
        >
          <PlusIcon size={19} />
          Log a fine
        </button>
      </div>
    </div>
  );
}
