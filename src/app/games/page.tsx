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
 *
 * Open games and locked ones are two different kinds of thing, so they are two
 * different elements. The open ones are a ListView: one tab stop for the lot,
 * arrow keys between them, typeahead on the names. The locked ones are plain
 * cards — not disabled list items — because a disabled row still sits in the
 * collection, still takes a turn under the arrow keys, and still announces
 * itself as something you might operate. A locked game is not a control in a
 * broken state; it is a fact about the ladder.
 */

import { useRouter } from 'next/navigation';
import { Card, Chip } from '@heroui/react';
import { ListView } from '@heroui-pro/react';
import { ChevronRightIcon } from '@/components/Icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { GAMES, isOpen, livesFrom, priceOfEntry } from '@/lib/games/catalogue';
import { sumFines, useStore } from '@/lib/store';

/** Local to this screen — a padlock is the only place the app needs one. */
function LockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.75"
      strokeLinecap="round"
      aria-hidden="true"
      className="text-muted"
    >
      <rect x="4" y="11" width="16" height="10" rx="2.5" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export default function GamesPage() {
  const router = useRouter();
  const { state } = useStore();

  const total = sumFines(state.fines);
  const lives = livesFrom(state.coins);

  /**
   * The lives count rides ON the row, not in the closure around it.
   *
   * React Aria's collections memoise a rendered row against its item, and the
   * render function is not re-run for a row whose item is unchanged. `lives`
   * read from the enclosing scope therefore froze at whatever it was on the
   * first pass — which is 1, because the store hydrates from localStorage in
   * an effect, after that pass. The result was Roll showing "1 life" beside
   * Breaker showing "7 lives", on one jar, from one variable.
   */
  const withLives = (list: typeof GAMES) =>
    list.map((g) => ({ ...g, lives: g.usesLives ? lives : null }));

  // The catalogue is ordered by price of entry and a jar has one total, so
  // "open" is a prefix of the list and "locked" is the rest. Splitting it in
  // two therefore keeps the catalogue's own order on screen.
  const unlocked = GAMES.filter((game) => isOpen(game, total));
  const locked = GAMES.filter((game) => !isOpen(game, total));

  return (
    <div className="sj-screen sj-screen--pushed">
      <ScreenHeader title="Games" backTo="/jar" tight />

      <div className="sj-body" style={{ padding: '12px 24px 20px', gap: 10 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: '0 0 6px' }}>
          Played with the coins in the jar. Nothing here earns anything — a fine is still the
          only way in.
        </p>

        {/* The item id is the route, so the action is the navigation. onAction
            and router.push rather than ListView.Item's own href: RAC turns an
            href into a real anchor and, with no RouterProvider wired up, a tap
            would be a full document load — which in the Capacitor shell means
            booting the app again to reach the next screen. */}
        <ListView
          aria-label="Games you can play"
          items={withLives(unlocked)}
          onAction={(key) => router.push(String(key))}
          // Unreachable while Roll is free, and the kit still needs it: an
          // empty GridList otherwise renders a focusable zero-height grid that
          // announces as an empty list.
          renderEmptyState={() => (
            <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
              Nothing open yet. The first fine opens the first game.
            </p>
          )}
          // flexShrink:0 is load-bearing. .list-view ships an explicit
          // min-height:0, which cancels the flexbox automatic minimum size, so
          // it becomes the only child of .sj-body that can be squashed — the
          // locked cards below would paint on top of the last open game rather
          // than pushing it down and scrolling.
          style={{ flexShrink: 0 }}
        >
          {(game) => (
            <ListView.Item id={game.href} textValue={game.name}>
              <ListView.ItemContent>
                <span
                  style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}
                >
                  <ListView.Title>{game.name}</ListView.Title>
                  {/* .list-view__description ships `truncate`, which cut
                      "A coin, a paddle, and a wall in the ..." mid-sentence.
                      These notes are one short line and the row can hold it. */}
                  <ListView.Description style={{ overflow: 'visible', whiteSpace: 'normal' }}>
                    {game.note}
                  </ListView.Description>
                </span>
              </ListView.ItemContent>
              <ListView.ItemAction className="flex items-center gap-2">
                {game.lives !== null && (
                  <Chip size="sm">
                    <Chip.Label>
                      {game.lives} {game.lives === 1 ? 'life' : 'lives'}
                    </Chip.Label>
                  </Chip>
                )}
                <ChevronRightIcon size={16} className="text-muted" />
              </ListView.ItemAction>
            </ListView.Item>
          )}
        </ListView>

        {/* Not buttons, not links, not list items: nothing to press, so nothing
            in the tab order. The transparent card is what says "not yet" —
            the surface under the open rows is simply absent here. The old row
            said it with opacity:0.55, which in dark mode dragged muted text
            down onto a near-black ground. */}
        {locked.map((game) => (
          <Card key={game.href} variant="transparent">
            <Card.Content
              style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              {/* The old row carried this on aria-label, on a div with no
                  role, where it is not reliably announced at all. The only
                  thing the visible text does not already say is that the game
                  is shut. */}
              <span className="sj-visually-hidden">Locked.</span>
              <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span className="text-muted" style={{ fontSize: 15, fontWeight: 500 }}>
                  {game.name}
                </span>
                <span className="text-muted" style={{ fontSize: 12 }}>
                  Opens at {priceOfEntry(game)} in the jar
                </span>
              </span>
              <LockIcon />
            </Card.Content>
          </Card>
        ))}

        <p className="text-muted" style={{ fontSize: 12, margin: '10px 2px 0' }}>
          Everyone starts with one ball. Every fine in the jar is another life, and cashing out
          puts you back to one.
        </p>
      </div>
    </div>
  );
}
