import type { NextConfig } from 'next';

/**
 * Two build targets from one codebase:
 *
 *   next build                      → Vercel. A normal Next app, so server
 *                                     route handlers can be added later for
 *                                     auth, pairing, sync and push.
 *   BUILD_TARGET=capacitor next build → a static `out/` bundle for the
 *                                     Capacitor iOS/Android wrapper.
 *
 * Every screen is a client component today, so both targets emit the same
 * UI. Keep it that way: anything server-only must stay behind a route
 * handler the native build talks to over HTTPS, never a server component.
 */
const isCapacitor = process.env.BUILD_TARGET === 'capacitor';

const nextConfig: NextConfig = {
  ...(isCapacitor ? { output: 'export' as const } : {}),
  reactStrictMode: true,
  images: { unoptimized: true },
  trailingSlash: isCapacitor,

  // The invite link in the design is sorryjar.app/j/<code>, but a path segment
  // cannot be a route under `output: 'export'` — the native build would need
  // every code at build time. The page lives at /join?c=<code>; this gives the
  // web the pretty URL. Rewrites are a no-op in an export, which is fine: the
  // native app never serves an invite link, it only opens one.
  async rewrites() {
    return [{ source: '/j/:code', destination: '/join?c=:code' }];
  },
};

export default nextConfig;
