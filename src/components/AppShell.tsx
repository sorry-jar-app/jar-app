'use client';

import { usePathname } from 'next/navigation';
import { TabBar } from './TabBar';

/** The only four routes that carry the tab bar. */
const TABBED = new Set(['/jar', '/history', '/stats', '/rules']);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="sj-app">
      {children}
      {TABBED.has(pathname) && <TabBar />}
    </div>
  );
}
