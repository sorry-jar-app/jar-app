'use client';

/**
 * The jar.
 *
 * Placeholder artwork, and knowingly so — the handoff calls for real
 * illustration before launch. It reads correctly: a rounded bottle, a lid, a
 * highlight arc, and coins stacked bottom-up from a fixed slot array and
 * clipped to the body.
 *
 * `animateLast` runs coinDrop on the newest coin. The caller gates it so the
 * animation fires on the landed screen and nowhere else.
 *
 * `jostleKey` makes the money move: bump it and every coin tumbles while the
 * jar shakes. It is a key rather than a boolean because a CSS animation only
 * restarts when the element remounts, and a shake has to be repeatable.
 */

import { useId } from 'react';
import { COIN_FILLS, COIN_SLOTS, JAR_BODY_PATH } from '@/lib/constants';

/**
 * A coin's own tumble, derived from its slot index rather than Math.random —
 * the server pass and the client pass have to agree, and a coin should also
 * move the same way every time so the jar feels like a physical object.
 */
function jostleOf(i: number) {
  const fract = (n: number) => n - Math.floor(n);
  const a = fract(Math.sin(i * 12.9898) * 43758.5453);
  const b = fract(Math.sin(i * 78.233) * 12345.6789);
  return {
    '--jx': `${((a * 2 - 1) * 5).toFixed(2)}px`,
    // Biased upward: shaking a jar throws the coins up, not sideways.
    '--jy': `${(-(2 + b * 5)).toFixed(2)}px`,
    '--jr': `${((b * 2 - 1) * 20).toFixed(1)}deg`,
    animationDelay: `${(i % 5) * 20}ms`,
  } as React.CSSProperties;
}

type JarProps = {
  width: number;
  height: number;
  coins: number;
  /** Run coinDrop on the newest coin. */
  animateLast?: boolean;
  /** Run jarNudge on the whole jar. */
  nudge?: boolean;
  /**
   * Bump to tumble the coins — shake, or a tap on the jar. Purely visual: it
   * never touches a fine or the total. 0 means "never shaken".
   */
  jostleKey?: number;
  /** The wash behind the coins. */
  fill?: string;
  fillOpacity?: number;
  /** The lid's inner shade and the highlight arc — dropped on the small jars. */
  showLidShade?: boolean;
  showHighlight?: boolean;
  highlightOpacity?: number;
  className?: string;
};

export function Jar({
  width,
  height,
  coins,
  animateLast = false,
  nudge = false,
  jostleKey = 0,
  fill = 'var(--color-accent-100)',
  fillOpacity = 0.55,
  showLidShade = true,
  showHighlight = true,
  highlightOpacity = 0.5,
  className,
}: JarProps) {
  // useId keeps the clipPath unique when two jars share a page.
  const clipId = `jar-clip-${useId().replace(/:/g, '')}`;
  const visible = COIN_SLOTS.slice(0, Math.max(0, coins));

  const jostling = jostleKey > 0;

  return (
    <svg
      viewBox="0 0 200 250"
      className={className}
      style={{
        width,
        height,
        display: 'block',
        animation: nudge ? 'jarNudge .6s ease .35s both' : undefined,
      }}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={JAR_BODY_PATH} />
        </clipPath>
      </defs>

      {/* Everything lives in this group so the whole jar can shake as one, and
          so remounting on jostleKey restarts the animations — a CSS animation
          will not replay on an element that merely re-rendered. */}
      <g key={jostleKey} className={jostling ? 'sj-jar-shake' : undefined}>
        <rect x="66" y="2" width="68" height="19" rx="9.5" fill="var(--color-accent-700)" />
        {showLidShade && (
          <rect x="78" y="16" width="44" height="12" fill="var(--color-accent-700)" opacity="0.22" />
        )}

        <g clipPath={`url(#${clipId})`}>
          <rect x="28" y="20" width="144" height="232" fill={fill} opacity={fillOpacity} />
          {visible.map(([cx, cy, r], i) => {
            const isNewest = animateLast && i === visible.length - 1;
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                fill={COIN_FILLS[i % COIN_FILLS.length]}
                className={jostling && !isNewest ? 'sj-coin-jostle' : undefined}
                style={
                  isNewest
                    ? {
                        animation: 'coinDrop .65s cubic-bezier(.34,1.25,.64,1) both',
                        transformOrigin: `${cx}px ${cy}px`,
                      }
                    : jostling
                      ? { ...jostleOf(i), transformOrigin: `${cx}px ${cy}px` }
                      : undefined
                }
              />
            );
          })}
        </g>

        <path
          d={JAR_BODY_PATH}
          fill="none"
          stroke="color-mix(in srgb, var(--color-text) 26%, transparent)"
          strokeWidth="3"
        />
        {showHighlight && (
          <path
            d="M48 92a26 26 0 0 1 22-24"
            fill="none"
            stroke="#fff"
            strokeWidth="5"
            strokeLinecap="round"
            opacity={highlightOpacity}
          />
        )}
      </g>
    </svg>
  );
}
