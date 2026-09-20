'use client';

/**
 * The door.
 *
 * The hub already hides the way in, but a locked game is one typed URL — or one
 * stale back-button — away, so the screen checks for itself. Wrapping rather
 * than redirecting: being told what a game costs is the point of the ladder,
 * and a silent bounce back to the hub would read as a broken link.
 *
 * It deliberately never shows the jar's total. Under Mystery jar that figure is
 * sealed, and "you have $5.50 of $8" would hand it straight back. What a game
 * costs is a fact about the game; what you have is not ours to print here.
 */

import { useRouter } from 'next/navigation';
import { ScreenHeader } from '@/components/ScreenHeader';
import { GAMES, isOpen, priceOfEntry, type GameEntry } from '@/lib/games/catalogue';
import { sumFines, useStore } from '@/lib/store';

export function GameGate({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  const { state, hydrated } = useStore();

  const entry: GameEntry | undefined = GAMES.find((g) => g.href === href);
  // An unlisted route is nobody's business to gate.
  if (!entry) return <>{children}</>;

  // Hold until the jar is known, or a locked game flashes open on first paint.
  if (!hydrated) return <div className="sj-screen sj-screen--pushed" />;

  if (isOpen(entry, sumFines(state.fines))) return <>{children}</>;

  return (
    <div className="sj-screen sj-screen--pushed">
      <ScreenHeader title={entry.name} backTo="/games" tight />

      <div
        className="sj-body"
        style={{ padding: '4px 24px 14px', gap: 10, alignItems: 'center', textAlign: 'center' }}
      >
        <div style={{ flex: 'none', marginTop: 40 }}>
          <svg
            width="56"
            height="56"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-accent-300)"
            strokeWidth="2.75"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <rect x="4" y="11" width="16" height="10" rx="2.5" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </div>

        <p role="status" style={{ fontSize: 15, margin: '14px 0 0', maxWidth: 270 }}>
          {entry.name} opens once there is {priceOfEntry(entry)} in the jar.
        </p>
        <p className="text-muted" style={{ fontSize: 13, margin: 0, maxWidth: 250 }}>
          Somebody had better do something.
        </p>
      </div>

      <div className="sj-footer">
        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ height: 54, fontSize: 17, marginTop: 0 }}
          onClick={() => router.push('/games')}
        >
          Back to the games
        </button>
      </div>
    </div>
  );
}
