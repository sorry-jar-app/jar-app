'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Which way is down, from the phone's point of view.
 *
 * Deliberately built on DeviceOrientation rather than DeviceMotion. Both are
 * permission-gated the same way on iOS, but `accelerationIncludingGravity` has
 * never had a sign convention the platforms agree on — get it backwards and the
 * coins fall upwards, which is a very visible way to be wrong. `beta` and
 * `gamma` are unambiguous: beta is the front-to-back tilt, gamma the
 * left-to-right, both in degrees.
 *
 * The vector returned is in SCREEN space — x right, y down — which is what the
 * coin simulation works in:
 *
 *   held upright   beta 90, gamma 0    -> (0, 1)    straight down
 *   lying flat     beta 0,  gamma 0    -> (0, 0)    nothing pulls
 *   tipped right   gamma 30            -> (0.5, …)  slides right
 *
 * Low-pass filtered, because a hand is never still and unfiltered readings make
 * the pile shiver.
 */

type OrientationCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied' | 'default'>;
};

export type Gravity = { x: number; y: number };

const UPRIGHT: Gravity = { x: 0, y: 1 };

/** How much of each new reading to take. Lower is smoother and laggier. */
const SMOOTHING = 0.18;

/** How far down must move, and how often at most, before we rouse the pile. */
const NUDGE_TILT = 0.06;
const NUDGE_MS = 200;

function needsPermission(): boolean {
  if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') return false;
  return typeof (DeviceOrientationEvent as OrientationCtor).requestPermission === 'function';
}

export function useTilt(enabled = true) {
  // A ref, not state: the simulation reads this every frame and re-rendering
  // sixty times a second to carry two numbers would be absurd.
  const gravity = useRef<Gravity>({ ...UPRIGHT });
  const [supported, setSupported] = useState(false);
  /**
   * Bumped when "down" has moved appreciably.
   *
   * The jar screen lets its simulation fall asleep to keep the animation frame
   * loop off the battery, and a sleeping pile ignores gravity — so tipping the
   * phone there would do nothing at all unless something rouses it. This is
   * that something, rate-limited so it is a nudge and not a second render loop.
   */
  const [nudge, setNudge] = useState(0);
  const lastNudge = useRef({ x: 0, y: 1, at: 0 });
  const [permitted, setPermitted] = useState(() => !needsPermission());
  const asked = useRef(false);

  /** Call from a user gesture. No-op where motion is not gated. */
  const requestAccess = useCallback(() => {
    if (asked.current || !needsPermission()) return;
    asked.current = true;
    (DeviceOrientationEvent as OrientationCtor)
      .requestPermission?.()
      .then((result) => setPermitted(result === 'granted'))
      .catch(() => {
        /* Declined. Gravity stays straight down and the games still work. */
      });
  }, []);

  useEffect(() => {
    if (!enabled || !permitted) return;
    if (typeof window === 'undefined') return;

    const onOrientation = (event: DeviceOrientationEvent) => {
      const { beta, gamma } = event;
      if (beta == null || gamma == null) return;

      setSupported(true);

      const rad = Math.PI / 180;
      // Clamped before the sine so a phone tipped past vertical does not start
      // pulling the coins back the other way mid-gesture.
      const gx = Math.sin(Math.max(-90, Math.min(90, gamma)) * rad);
      const gy = Math.sin(Math.max(-90, Math.min(90, beta)) * rad);

      const g = gravity.current;
      g.x += (gx - g.x) * SMOOTHING;
      g.y += (gy - g.y) * SMOOTHING;

      const seen = lastNudge.current;
      const moved = Math.hypot(g.x - seen.x, g.y - seen.y);
      const now = event.timeStamp || 0;
      if (moved > NUDGE_TILT && now - seen.at > NUDGE_MS) {
        lastNudge.current = { x: g.x, y: g.y, at: now };
        setNudge((n) => n + 1);
      }
    };

    window.addEventListener('deviceorientation', onOrientation);
    return () => window.removeEventListener('deviceorientation', onOrientation);
  }, [enabled, permitted]);

  // Back to straight down when the hook stops, so a screen that keeps the jar
  // on view does not inherit a stale tilt.
  useEffect(() => {
    if (enabled) return;
    gravity.current = { ...UPRIGHT };
  }, [enabled]);

  return { gravity, requestAccess, permitted, supported, nudge };
}

/** How far from upright, 0 (level) to 1 (on its side). Handy as a score. */
export function tiltAmount(g: Gravity): number {
  return Math.min(1, Math.hypot(g.x, Math.max(0, 1 - g.y)));
}
