'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeftIcon } from './Icons';

/**
 * Back button + title, the chrome on every pushed screen.
 *
 * `backTo` is explicit rather than router.back() so the flow is the one the
 * handoff specifies — One-off goes back to Log, Rule detail back to Rules —
 * no matter how the screen was reached.
 */
export function ScreenHeader({
  title,
  backTo,
  tight = false,
}: {
  title: string;
  backTo: string;
  tight?: boolean;
}) {
  const router = useRouter();

  return (
    <div className={tight ? 'sj-header sj-header--tight' : 'sj-header'}>
      <button
        type="button"
        className="btn btn-icon btn-secondary"
        aria-label="Back"
        onClick={() => router.push(backTo)}
      >
        <ChevronLeftIcon />
      </button>
      <span className="sj-title">{title}</span>
    </div>
  );
}
