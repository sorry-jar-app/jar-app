'use client';

import { usePathname } from 'next/navigation';
import { SyncNotice } from './SyncNotice';
import { TabBar } from './TabBar';

/** The only four routes that carry the tab bar. */
const TABBED = new Set(['/jar', '/history', '/stats', '/rules']);

/**
 * The Capacitor build sets trailingSlash, so the same route is '/jar' on
 * Vercel and '/jar/' in the native wrapper. Compare without it.
 */
export function normalizePath(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="sj-app">
      {children}
      <SyncNotice />
      {TABBED.has(normalizePath(pathname)) && <TabBar />}
    </div>
  );
}
