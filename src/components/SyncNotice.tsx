'use client';

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
 */
export function SyncNotice() {
  const { syncError } = useStore();
  if (!syncError) return null;

  return (
    <div className="sj-sync-notice" role="status" aria-live="polite">
      {syncError}
    </div>
  );
}
