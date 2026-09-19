import type { Person } from '@/lib/types';

/**
 * The 28px initial disc.
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

  return (
    <span
      className="sj-avatar"
      style={{
        width: size,
        height: size,
        fontSize: size >= 28 ? 12 : 11,
        background: inverted ? 'var(--color-bg)' : filled,
        color: inverted ? invertedInk : 'var(--color-bg)',
      }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
