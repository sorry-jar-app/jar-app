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
};

export default nextConfig;
