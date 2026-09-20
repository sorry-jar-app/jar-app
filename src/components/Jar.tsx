'use client';

/**
 * The jar.
 *
 * Placeholder artwork, and knowingly so — the handoff calls for real
 * illustration before launch. It reads correctly: a rounded bottle, a lid, a
 * highlight arc, and coins clipped to the body.
 *
 * `animateLast` runs coinDrop on the newest coin. The caller gates it so the
 * animation fires on the landed screen and nowhere else.
 *
 * `tumbleKey` throws the money around: bump it and the coins are flung, then
 * fall, bounce off the walls and off each other, and settle wherever they
 * land. That is a real simulation rather than an animation — see lib/coinTumble
 * for why. It writes cx/cy straight to the DOM, because re-rendering nineteen
 * circles through React sixty times a second is not what React is for.
 */

import { useCallback, useEffect, useId, useRef } from 'react';
import { COIN_FILLS, COIN_SLOTS, JAR_BODY_PATH } from '@/lib/constants';
import { fromSlots, kick, step, type Coin } from '@/lib/coinTumble';

type JarProps = {
  width: number;
  height: number;
  coins: number;
  /** Run coinDrop on the newest coin. */
  animateLast?: boolean;
  /** Run jarNudge on the whole jar. */
  nudge?: boolean;
  /**
   * Bump to fling the coins. Purely visual: it never touches a fine or the
   * total. 0 means "never shaken".
   */
  tumbleKey?: number;
  /** The wash behind the coins. */
  fill?: string;
  fillOpacity?: number;
  /** The lid's inner shade and the highlight arc — dropped on the small jars. */
  showLidShade?: boolean;
  showHighlight?: boolean;
  highlightOpacity?: number;
  className?: string;
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function Jar({
  width,
  height,
  coins,
  animateLast = false,
  nudge = false,
  tumbleKey = 0,
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

  const nodes = useRef<(SVGCircleElement | null)[]>([]);
  const sim = useRef<Coin[]>([]);
  const raf = useRef<number | null>(null);
  const body = useRef<SVGGElement | null>(null);

  const paint = useCallback(() => {
    for (let i = 0; i < sim.current.length; i++) {
      const node = nodes.current[i];
      if (!node) continue;
      const c = sim.current[i];
      node.setAttribute('cx', c.x.toFixed(2));
      node.setAttribute('cy', c.y.toFixed(2));
    }
  }, []);

  // Re-seat the coins whenever the count changes — a fine landing, an undo, a
  // cash-out. Positions reset to the designed pile rather than being carried
  // over from wherever physics last left them.
  useEffect(() => {
    sim.current = fromSlots(COIN_SLOTS.slice(0, Math.max(0, coins)));
    paint();
  }, [coins, paint]);

  const run = useCallback(() => {
    if (raf.current !== null) return;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const moving = step(sim.current, dt);
      paint();
      if (moving) {
        raf.current = requestAnimationFrame(frame);
      } else {
        raf.current = null;
      }
    };
    raf.current = requestAnimationFrame(frame);
  }, [paint]);

  useEffect(() => {
    if (tumbleKey === 0) return;
    if (prefersReducedMotion()) return;
    if (sim.current.length === 0) return;

    kick(sim.current);
    run();

    // A short rock of the glass, restarted imperatively so the group never
    // remounts and the coin refs survive.
    body.current?.animate(
      [
        { transform: 'translateX(0) rotate(0deg)' },
        { transform: 'translateX(-5px) rotate(-1.8deg)', offset: 0.1 },
        { transform: 'translateX(5px) rotate(1.8deg)', offset: 0.26 },
        { transform: 'translateX(-4px) rotate(-1.3deg)', offset: 0.42 },
        { transform: 'translateX(3px) rotate(0.9deg)', offset: 0.58 },
        { transform: 'translateX(-2px) rotate(-0.5deg)', offset: 0.74 },
        { transform: 'translateX(0) rotate(0deg)' },
      ],
      { duration: 700, easing: 'cubic-bezier(.36,.07,.19,.97)' },
    );
  }, [tumbleKey, run]);

  useEffect(() => {
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, []);

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

      {/* The jar body rocks, but only slightly — the money is what should move. */}
      <g ref={body}>
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
                ref={(el) => {
                  nodes.current[i] = el;
                }}
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
      </g>
    </svg>
  );
}
