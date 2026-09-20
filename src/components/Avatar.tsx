import { Avatar as HeroAvatar } from '@heroui/react';
import type { Person } from '@/lib/types';

/**
 * The initial disc, on HeroUI's Avatar.
 *
 * Avatar.Fallback renders when there is no image, which is the whole of this
 * app — there are no photos, only initials. Composing it now means a face can
 * be dropped in later as Avatar.Image, with the initial staying as the
 * fallback, and nothing else has to move.
 *
 * The one thing that is ours is the colour. --who-a and --who-s come from
 * artwork.css and are shared with the jar, the coins and the split bar, so a
 * person reads as the same colour everywhere. They sit on the ROOT alongside
 * the size and the 50% radius: .avatar centres its child and .avatar__fallback
 * shrink-wraps the letter, so a fill on the fallback draws an ellipse rather
 * than a disc. Type, clipping and everything else is the theme's.
 *
 * `inverted` is for an avatar sitting on a filled surface, where a disc in the
 * person's own colour would disappear into it: the disc goes to the page
 * colour and the letter takes the person's.
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
  const fill = person === 'A' ? 'var(--who-a)' : 'var(--who-s)';
  /**
   * The same pale ink on both, never the theme's per-semantic foreground.
   *
   * S used to take --success-foreground, which glass resolves to its dark ink
   * in BOTH modes — so in light, S's initial was dark on mid teal at 4.10:1
   * while A's was white on deep rose. Two people, two inks, one of them
   * failing. --who-s is a step darker in light to carry this one.
   */
  const ink = 'var(--accent-foreground)';

  return (
    <HeroAvatar
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: inverted ? 'var(--background)' : fill,
      }}
    >
      <HeroAvatar.Fallback
        // Transparent, or .avatar__fallback's own bg-default paints over the
        // disc the root just drew.
        style={{ background: 'transparent', color: inverted ? fill : ink }}
      >
        {initial}
      </HeroAvatar.Fallback>
    </HeroAvatar>
  );
}
