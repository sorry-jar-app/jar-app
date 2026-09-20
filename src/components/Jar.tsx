'use client';


import { useCallback, useEffect, useId, useRef } from 'react';
import { COIN_FILLS, COIN_SLOTS, JAR_BODY_PATH } from '@/lib/constants';
import { fromSlots, kick, step, wake, type Coin } from '@/lib/coinTumble';
import { prefersReducedMotion } from '@/lib/reducedMotion';

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
  /**
   * Which way is down, in screen space. A ref rather than a value so the tilt
   * can change every frame without re-rendering. Defaults to straight down.
   */
  gravity?: { current: { x: number; y: number } };
  /**
   * Keep the simulation running even once the coins settle. Games that read
   * live tilt need it; the jar screen does not, and letting it sleep is what
   * keeps the animation frame loop off the battery.
   */
  alwaysOn?: boolean;
  /** Called after each simulated frame, for a game that needs the positions. */
  onFrame?: (coins: readonly Coin[]) => void;
  /**
   * Bump to rouse a settled pile without throwing it — what a tilt does. The
   * loop starts, the coins slide to the new down, and it sleeps again.
   */
  wakeKey?: number;
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
  tumbleKey = 0,
  gravity,
  wakeKey = 0,
  alwaysOn = false,
  onFrame,
  fill = 'var(--jar-glass)',
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

  // Kept in refs so changing either does not tear down a running loop.
  const gravityRef = useRef(gravity);
  gravityRef.current = gravity;
  const frameCb = useRef(onFrame);
  frameCb.current = onFrame;
  const keepAwake = useRef(alwaysOn);
  keepAwake.current = alwaysOn;

  const run = useCallback(() => {
    if (raf.current !== null) return;
    let last = performance.now();
    let lastG = { x: 0, y: 1 };
    const frame = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const g = gravityRef.current?.current ?? { x: 0, y: 1 };

      // A sleeping coin ignores gravity, so tipping the phone has to rouse the
      // pile or nothing slides.
      if (Math.hypot(g.x - lastG.x, g.y - lastG.y) > 0.03) {
        wake(sim.current);
        lastG = { x: g.x, y: g.y };
      }

      const moving = step(sim.current, dt, g.x, g.y);
      paint();
      frameCb.current?.(sim.current);
      if (moving || keepAwake.current) {
        raf.current = requestAnimationFrame(frame);
      } else {
        raf.current = null;
      }
    };
    raf.current = requestAnimationFrame(frame);
  }, [paint]);

  // A game turns the loop on and leaves it on; the jar screen never does.
  useEffect(() => {
    if (alwaysOn) run();
  }, [alwaysOn, run]);

  useEffect(() => {
    if (wakeKey === 0) return;
    if (prefersReducedMotion()) return;
    wake(sim.current);
    run();
  }, [wakeKey, run]);

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
        <rect x="66" y="2" width="68" height="19" rx="9.5" fill="var(--jar-lid)" />
        {showLidShade && (
          <rect x="78" y="16" width="44" height="12" fill="var(--jar-lid)" opacity="0.22" />
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
          stroke="var(--jar-rim)"
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
