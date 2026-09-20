/**
 * What the jar has to be worth before a game opens.
 *
 * The number in the name is the price of entry: Four in a row wants four
 * dollars in the jar, Eight ball wants eight. Not a progression system bolted
 * on — the jar is the table, and you cannot rack a full frame on small change.
 *
 * Two consequences, both deliberate:
 *
 *   Cashing out re-locks the bigger games. You spent it; you are back to Roll.
 *
 *   Nothing here nags. The client declined streak reminders, weekly recaps and
 *   re-engagement nudges, and this is none of those: the ladder is a fact the
 *   hub states when you visit it, and it never comes looking for you.
 *
 * The coins do a second job. In the games that have lives, a coin IS a life:
 * the jar you are playing with is the one on the home screen, so a full jar is
 * forgiving and an empty one gives you a single ball and no second chance.
 */

export type GameEntry = {
  href: string;
  name: string;
  note: string;
  /** Dollars that must be in the jar. 0 is always open. */
  needs: number;
  /** True where a coin in the jar is a life. */
  usesLives?: boolean;
};

export const GAMES: readonly GameEntry[] = [
  {
    href: '/games/roll',
    name: 'Roll',
    note: 'Tilt one coin down without losing it.',
    needs: 0,
    usesLives: true,
  },
  {
    href: '/games/whos-it',
    name: "Who's it?",
    note: 'No skill at all. Settles it anyway.',
    needs: 1,
  },
  {
    href: '/games/breaker',
    name: 'Breaker',
    note: 'A coin, a paddle, and a wall in the way.',
    needs: 2,
    usesLives: true,
  },
  {
    href: '/games/four',
    name: 'Four in a row',
    note: 'Them, this phone, or the machine.',
    needs: 4,
  },
  {
    href: '/games/eightball',
    name: 'Eight ball',
    note: 'Pass the phone. Do not scratch.',
    needs: 8,
  },
];

export function isOpen(entry: GameEntry, total: number): boolean {
  return total >= entry.needs;
}

/** "$8" — the threshold, which is a fact about the game, not about your jar. */
export function priceOfEntry(entry: GameEntry): string {
  return '$' + entry.needs;
}

/**
 * How many goes the jar buys you.
 *
 * One coin, one life, straight through — a fat jar really is easier, which is
 * the point. Everyone starts with one: a new jar is empty, so the first game
 * anyone plays is a single ball with no second chance, and every fine after
 * that buys another.
 */
export function livesFrom(coins: number): number {
  return Math.max(1, coins);
}
