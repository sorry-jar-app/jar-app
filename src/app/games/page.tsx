'use client';

/**
 * The games.
 *
 * Nothing here moves money. A game may end by handing you to /log, which is the
 * same path the jar screen's button takes; the jar still only ever fills from a
 * fine.
 *
 * Locked games are shown, not hidden — the ladder is half the fun, and a list
 * that grew silently would read as a bug. What is never shown here is the jar's
 * total: under Mystery jar that figure is sealed, and a "$5.50 of $8" progress
 * line would hand it straight back. A locked row says what the game costs to
 * open and nothing about what you have.
 */

import { useRouter } from 'next/navigation';
import { ChevronRightIcon } from '@/components/Icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { GAMES, isOpen, livesFrom, priceOfEntry } from '@/lib/games/catalogue';
import { sumFines, useStore } from '@/lib/store';

export default function GamesPage() {
  const router = useRouter();
  const { state } = useStore();

  const total = sumFines(state.fines);
  const lives = livesFrom(state.coins);

  return (
    <div className="sj-screen sj-screen--pushed">
      <ScreenHeader title="Games" backTo="/jar" tight />

      <div className="sj-body" style={{ padding: '12px 24px 20px', gap: 9 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: '0 0 6px' }}>
          Played with the coins in the jar. Nothing here earns anything — a fine is still the
          only way in.
        </p>

        {GAMES.map((game) => {
          const open = isOpen(game, total);

          if (!open) {
            return (
              <div
                key={game.href}
                className="sj-surface-row"
                aria-label={`${game.name}, locked until the jar reaches ${priceOfEntry(game)}`}
                style={{ opacity: 0.55 }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 15, display: 'block' }}>{game.name}</span>
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    Opens at {priceOfEntry(game)} in the jar
                  </span>
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.75"
                  strokeLinecap="round"
                  aria-hidden="true"
                  style={{ opacity: 0.45 }}
                >
                  <rect x="4" y="11" width="16" height="10" rx="2.5" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </div>
            );
          }

          return (
            <button
              key={game.href}
              type="button"
              className="sj-surface-row sj-row"
              onClick={() => router.push(game.href)}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 15, display: 'block' }}>{game.name}</span>
                <span className="text-muted" style={{ fontSize: 12 }}>
                  {game.note}
                </span>
              </span>
              {game.usesLives && (
                <span className="tag tag-accent-2">
                  {lives} {lives === 1 ? 'life' : 'lives'}
                </span>
              )}
              <ChevronRightIcon size={16} style={{ opacity: 0.45 }} />
            </button>
          );
        })}

        <p className="text-muted" style={{ fontSize: 12, margin: '10px 2px 0' }}>
          Everyone starts with one ball. Every fine in the jar is another life, and cashing out
          puts you back to one.
        </p>
      </div>
    </div>
  );
}
