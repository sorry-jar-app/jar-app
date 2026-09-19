'use client';

import { useEffect } from 'react';

/**
 * Registers the offline shell.
 *
 * Skipped under Capacitor: the native wrapper serves the bundle from disk
 * already, and a service worker on the capacitor:// origin buys nothing.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (window.location.protocol === 'capacitor:') return;
    if (process.env.NODE_ENV !== 'production') return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* An unavailable worker is not worth breaking the app over. */
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
