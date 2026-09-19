'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarsIcon, JarIcon, ListIcon, RulesIcon } from './Icons';

/**
 * Four tabs, on Home / History / Stats / Rules only. Every pushed screen and
 * the whole of onboarding hide it — AppShell decides, from the route.
 */
const TABS = [
  { href: '/jar', label: 'Jar', Icon: JarIcon },
  { href: '/history', label: 'History', Icon: ListIcon },
  { href: '/stats', label: 'Stats', Icon: BarsIcon },
  { href: '/rules', label: 'Rules', Icon: RulesIcon },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="sj-tabbar" aria-label="Main">
      {TABS.map(({ href, label, Icon }) => {
        const current = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className="sj-tab"
            aria-current={current ? 'page' : undefined}
          >
            <Icon size={21} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
