'use client';

import { Alert } from '@heroui/react';
import { useStore } from '@/lib/store';

/**
 * A failed background write, said out loud.
 *
 * Writes are optimistic: the change is on screen before the database has
 * agreed to it. When the database refuses — a fine on a partner who has not
 * joined, an Undo past its five-minute window — nothing changes server side,
 * so no realtime event arrives to put the screen right. The store refetches,
 * which makes the change disappear again; without this the person just watches
 * it vanish and is told nothing.
 *
 * It floats over the screen rather than taking a row in it, clear of the tab
 * bar. That position is the only thing said here; the banner itself is the
 * theme's danger Alert.
 */
export function SyncNotice() {
  const { syncError } = useStore();
  if (!syncError) return null;

  return (
    <Alert
      status="danger"
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        // .alert is w-full, which would run it past the right edge once both
        // sides are pinned.
        width: 'auto',
        bottom: 'calc(var(--sj-tabbar-space) + 10px)',
        zIndex: 6,
      }}
    >
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{syncError}</Alert.Title>
      </Alert.Content>
    </Alert>
  );
}
