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
 */

import { useId } from 'react';
import { COIN_FILLS, COIN_SLOTS, JAR_BODY_PATH } from '@/lib/constants';

type JarProps = {
  width: number;
  height: number;
  coins: number;
  /** Run coinDrop on the newest coin. */
  animateLast?: boolean;
  /** Run jarNudge on the whole jar. */
  nudge?: boolean;
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
              style={
                isNewest
                  ? {
                      animation: 'coinDrop .65s cubic-bezier(.34,1.25,.64,1) both',
                      transformOrigin: `${cx}px ${cy}px`,
                    }
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
    </svg>
  );
}
