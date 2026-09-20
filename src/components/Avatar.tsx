import { Avatar as HeroAvatar } from '@heroui/react';
import type { Person } from '@/lib/types';

/**
 * The 28px initial disc, on HeroUI's Avatar.
 *
 * Avatar.Root renders a span and Avatar.Fallback renders when there is no
 * image, which is the whole of this app — there are no photos, only initials.
 * Composing it now means a face can be dropped in later as Avatar.Image with
 * the initial staying as the fallback, and nothing else has to move.
 *
 * .sj-avatar keeps the geometry: it loads after @heroui/styles, so its 50%
 * radius wins over .avatar's rounded-3xl. The fallback's fill and ink are
 * inline because they are per-person, and its font-size is inline because
 * .avatar__fallback sets text-sm and a class cannot be conditional here.
 *
 * The inverted variant is the rule from the handoff: when a Who pill is
 * selected, its avatar flips to a cream disc with the initial in the deep
 * ramp step. Without it the disc is the same colour as the pill fill and
 * vanishes.
 */
export function Avatar({
  person,
  initial,
  inverted = false,
  size = 28,
}: {
  person: Person;
  initial: string;
  inverted?: boolean;
  size?: number;
}) {
  const filled = person === 'A' ? 'var(--color-accent-600)' : 'var(--color-accent-2-600)';
  const invertedInk = person === 'A' ? 'var(--color-accent-700)' : 'var(--color-accent-2-700)';

  // 11px is .sj-avatar's own value, the prototype's. Only scale it if the disc
  // itself is scaled away from the 28px default.
  const fontSize = size === 28 ? 11 : Math.round(size * 0.39);

  return (
    <HeroAvatar
      className="sj-avatar"
      aria-hidden="true"
      // The fill belongs on the root, which is where it was before HeroUI and
      // where .sj-avatar's own 50% radius and 28px box already are. Moving it
      // to the fallback looked equivalent and was not: .sj-avatar is a grid
      // with place-items:center, the fallback shrink-wraps to the width of the
      // letter, and the disc rendered as an 8px ellipse. size-full on the
      // fallback does not save it, and neither does place-items:stretch.
      style={{
        width: size,
        height: size,
        background: inverted ? 'var(--color-bg)' : filled,
        color: inverted ? invertedInk : 'var(--color-bg)',
        fontSize,
        fontWeight: 700,
      }}
    >
      <HeroAvatar.Fallback
        // Transparent: the root carries the disc. This only carries the letter,
        // and must not reintroduce HeroUI's own bg-default underneath it.
        style={{ background: 'transparent', color: 'inherit', font: 'inherit' }}
      >
        {initial}
      </HeroAvatar.Fallback>
    </HeroAvatar>
  );
}
