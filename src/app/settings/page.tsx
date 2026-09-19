'use client';

import { useRouter } from 'next/navigation';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Toggle } from '@/components/Toggle';
import { JAR_STARTED } from '@/lib/constants';
import { useStore } from '@/lib/store';

const STATIC_ROWS: ReadonlyArray<{ label: string; value: string }> = [
  { label: 'Currency', value: 'USD $' },
  { label: 'Jar started', value: JAR_STARTED },
  { label: 'Export history', value: 'CSV' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { state, dispatch } = useStore();

  return (
    <div className="sj-screen sj-screen--pushed">
      <ScreenHeader title="Settings" backTo="/jar" tight />

      <div className="sj-body" style={{ padding: '16px 24px 20px', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <h6 className="sj-label">Names</h6>
          <div className="field">
            <label htmlFor="settings-you">You</label>
            <input
              id="settings-you"
              className="input"
              value={state.me}
              onChange={(e) => dispatch({ type: 'setName', person: 'A', name: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="settings-them">Them</label>
            <input
              id="settings-them"
              className="input"
              value={state.partner}
              onChange={(e) => dispatch({ type: 'setName', person: 'S', name: e.target.value })}
            />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '15px 18px',
            background: 'var(--color-accent-2-100)',
            borderRadius: 26,
          }}
        >
          <span className="sj-dot" style={{ background: 'var(--color-accent-2-600)' }} />
          <span style={{ flex: 1, fontSize: 14 }}>Paired with {state.partner}</span>
          <span className="tag tag-accent-2">Since March</span>
        </div>

        <button
          type="button"
          className="sj-toggle-row"
          data-on={state.mystery}
          aria-pressed={state.mystery}
          onClick={() => dispatch({ type: 'mystery/toggle' })}
        >
          <span style={{ flex: 1 }}>
            <span style={{ fontSize: 15, display: 'block' }}>Mystery jar</span>
            <span className="text-muted" style={{ fontSize: 12 }}>
              Hide the running total until you cash out
            </span>
          </span>
          <Toggle on={state.mystery} />
        </button>

        <div className="sj-stack">
          {STATIC_ROWS.map((row) => (
            <div key={row.label} className="sj-surface-row sj-row">
              <span style={{ flex: 1, fontSize: 15 }}>{row.label}</span>
              <span className="text-muted" style={{ fontSize: 14 }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="btn btn-ghost btn-block"
          style={{ height: 46, color: 'var(--color-accent-700)' }}
          onClick={() => {
            dispatch({ type: 'reset' });
            router.push('/jar');
          }}
        >
          Reset this demo
        </button>
      </div>
    </div>
  );
}
