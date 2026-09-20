'use client';

import { Button } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { ChevronLeftIcon } from './Icons';

/**
 * Back button + title, the chrome on every pushed screen.
 *
 * `backTo` is explicit rather than router.back() so the flow is the one the
 * handoff specifies — One-off goes back to Log, Rule detail back to Rules —
 * no matter how the screen was reached.
 *
 * The button is HeroUI's, wearing the app's .btn classes: onPress handles
 * touch, pen and keyboard as one thing and cancels cleanly when a press turns
 * into a scroll, which is the bug a plain onClick has on a phone.
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
      <Button
        className="btn btn-icon btn-secondary"
        variant="ghost"
        isIconOnly
        aria-label="Back"
        onPress={() => router.push(backTo)}
      >
        {/* .button sizes its own svg children at 20px, and 16px above 640.
            The glyph is 17px here, as it is everywhere else in the app. */}
        <ChevronLeftIcon style={{ width: 17, height: 17, margin: 0 }} />
      </Button>
      <span className="sj-title">{title}</span>
    </div>
  );
}
