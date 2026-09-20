'use client';

import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Whether the person has asked for less movement.
 *
 * The global rule in app.css crushes CSS animation and transition durations to
 * nothing, which covers the declarative half of the app. It does nothing at all
 * to requestAnimationFrame or the Web Animations API — so every game loop, and
 * anything driven imperatively, has to ask for itself.
 *
 * Safe during the server pass: returns false where there is no matchMedia.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

/**
 * The same preference, as state, kept current if it changes mid-session.
 *
 * Use this where a component must re-render on the change — a game deciding
 * whether to run its loop at all. The plain function above is enough inside an
 * effect or a handler.
 *
 * Starts false so the server pass and the first client pass agree, then
 * corrects after mount.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
