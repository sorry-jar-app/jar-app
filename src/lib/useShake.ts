'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Shake the phone, and the caller gets told.
 *
 * Two things make this less trivial than it looks:
 *
 *   1. iOS 13+ will not deliver `devicemotion` at all until
 *      `DeviceMotionEvent.requestPermission()` has been called *from a user
 *      gesture*. So the hook cannot just subscribe on mount — it hands back
 *      `requestAccess`, which the page calls from a real tap. Everywhere else
 *      (Android, desktop, the Capacitor WebView) the listener attaches
 *      straight away and `requestAccess` is a no-op.
 *
 *   2. `devicemotion` fires ~60 times a second. Shake detection is the sum of
 *      the per-axis change between samples, against a threshold, with a
 *      cooldown so one wobble does not fire five times.
 */

type MotionCtor = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied' | 'default'>;
};

/** Sum of per-axis acceleration change, in m/s², that counts as a shake. */
const DEFAULT_THRESHOLD = 22;

/** How long to ignore further shakes, so one wobble fires once. */
const DEFAULT_COOLDOWN_MS = 900;

function needsPermission(): boolean {
  if (typeof window === 'undefined' || typeof DeviceMotionEvent === 'undefined') return false;
  return typeof (DeviceMotionEvent as MotionCtor).requestPermission === 'function';
}

export function useShake(
  onShake: () => void,
  options?: { threshold?: number; cooldownMs?: number; enabled?: boolean },
) {
  const threshold = options?.threshold ?? DEFAULT_THRESHOLD;
  const cooldownMs = options?.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const enabled = options?.enabled ?? true;

  // Kept in a ref so a new callback identity does not tear the listener down
  // and rebuild it on every render.
  const handler = useRef(onShake);
  useEffect(() => {
    handler.current = onShake;
  }, [onShake]);

  // On iOS this flips once permission is granted; elsewhere it starts true.
  const [permitted, setPermitted] = useState(() => !needsPermission());
  const asked = useRef(false);

  /**
   * Call from a user gesture. Safe to call repeatedly — it only ever prompts
   * once, and does nothing at all on platforms that do not gate motion.
   */
  const requestAccess = useCallback(() => {
    if (asked.current || !needsPermission()) return;
    asked.current = true;
    const ctor = DeviceMotionEvent as MotionCtor;
    ctor
      .requestPermission?.()
      .then((result) => setPermitted(result === 'granted'))
      .catch(() => {
        // Declined, or not available in this context. Tapping the jar still
        // works, so there is nothing to recover from.
      });
  }, []);

  useEffect(() => {
    if (!enabled || !permitted) return;
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return;

    let lastX: number | null = null;
    let lastY = 0;
    let lastZ = 0;
    let lastShake = 0;

    const onMotion = (event: DeviceMotionEvent) => {
      const a = event.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;

      // The first sample only seeds the baseline — there is nothing to
      // compare it against yet.
      if (lastX === null) {
        lastX = a.x;
        lastY = a.y;
        lastZ = a.z;
        return;
      }

      const delta = Math.abs(a.x - lastX) + Math.abs(a.y - lastY) + Math.abs(a.z - lastZ);
      lastX = a.x;
      lastY = a.y;
      lastZ = a.z;

      if (delta < threshold) return;

      const now = event.timeStamp || performance.now();
      if (now - lastShake < cooldownMs) return;
      lastShake = now;
      handler.current();
    };

    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [enabled, permitted, threshold, cooldownMs]);

  return { requestAccess, permitted };
}
