'use client';

import { useEffect, useState } from 'react';

import { ScreenHeader } from '@/components/ScreenHeader';
import { Toggle } from '@/components/Toggle';
import { money } from '@/lib/money';
import { rowLabel } from '@/lib/when';
import { useStore } from '@/lib/store';
import type { Fine, NotificationPrefs } from '@/lib/types';

/**
 * Attributed by who LOGGED the fine (`by`), not who it landed on (`who`) —
 * the same fine reads differently depending on which of the two sent it.
 * Individual amounts never seal, so this is money(), not veil().
 */
function eventLine(fine: Fine, partner: string): string {
  const amt = money(fine.amt);
  if (fine.by === 'A') {
    return fine.who === 'A'
      ? `You fined yourself ${amt}`
      : `You fined ${partner} ${amt}`;
  }
  return fine.who === 'A'
    ? `${partner} fined you ${amt}`
    : `${partner} fined themselves ${amt}`;
}

export default function NotificationsPage() {
  const { state, dispatch } = useStore();
  const { partner, fines, notif } = state;

  // Taken after mount: relative labels read from the clock, and the server
  // pass would disagree with the client's.
  // Seeded fines carry display strings and never consult the clock, and real
  // ones only exist after hydration — so this never differs across the two
  // passes, and there is no epoch-valued first paint to flash through.
  const now = new Date();

  const prefRows: { key: keyof NotificationPrefs; name: string; note: string }[] = [
    { key: 'fined', name: `${partner} fines you`, note: 'The moment it lands' },
    {
      key: 'selfFined',
      name: `${partner} fines themselves`,
      note: 'Rare, but worth celebrating',
    },
    {
      key: 'milestone',
      name: 'The jar hits a round number',
      note: '$50, $100, and so on',
    },
  ];

  return (
    <div className="sj-screen sj-screen--pushed">
      <ScreenHeader title="Notifications" backTo="/jar" tight />

      <div className="sj-body" style={{ padding: '16px 24px 20px', gap: '10px' }}>
        <h6 className="sj-label" style={{ margin: '0 2px' }}>
          Recent
        </h6>

        {fines.slice(0, 4).map((fine) => (
          <div
            key={fine.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '14px 18px',
              background: 'var(--color-accent-100)',
              borderRadius: '26px',
            }}
          >
            <span
              className="sj-dot"
              style={{
                marginTop: '6px',
                background:
                  fine.who === 'A'
                    ? 'var(--color-accent-500)'
                    : 'var(--color-accent-2-500)',
              }}
            />
            <span style={{ flex: 1 }}>
              <span style={{ fontSize: '14px', display: 'block' }}>
                {eventLine(fine, partner)}
              </span>
              <span className="text-muted" style={{ fontSize: '12px' }}>
                {fine.label} · {rowLabel(fine.when, now)}
              </span>
            </span>
          </div>
        ))}

        {fines.length === 0 && (
          <p className="text-muted" style={{ fontSize: '13px', margin: '2px 2px 0' }}>
            Quiet in here.
          </p>
        )}

        <h6 className="sj-label" style={{ margin: '16px 2px 0' }}>
          Tell me when
        </h6>

        {/* Real switches. Each row is a <label role="switch"> now rather than a
            <button aria-pressed> with a decorative track beside it, so the
            name, the note and the state are one control. */}
        {prefRows.map((row) => (
          <Toggle
            key={row.key}
            on={notif[row.key]}
            onChange={() => dispatch({ type: 'notif/toggle', key: row.key })}
            label={row.name}
            description={row.note}
          />
        ))}

        <p className="text-muted" style={{ fontSize: '12px', margin: '6px 2px 0' }}>
          Nothing else will buzz you. No streak nags, no weekly recaps.
        </p>
      </div>
    </div>
  );
}
