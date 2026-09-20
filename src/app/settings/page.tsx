'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRightIcon } from '@/components/Icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Toggle } from '@/components/Toggle';
import { JAR_STARTED } from '@/lib/constants';
import { downloadCsv, finesToRows, toCsv, type ExportEntry } from '@/lib/csv';
import { getSupabase } from '@/lib/supabase/client';
import { loadAllFines } from '@/lib/supabase/api';
import { formatStarted } from '@/lib/when';
import { useStore } from '@/lib/store';

/** `sorry-jar-2026-09-20.csv`, in the phone's own timezone rather than UTC. */
function filename(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `sorry-jar-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.csv`;
}

export default function SettingsPage() {
  const router = useRouter();
  const { state, dispatch, auth, configured, remote, signOut } = useStore();
  const [signingOut, setSigningOut] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const rows: ReadonlyArray<{ label: string; value: string }> = [
    { label: 'Currency', value: 'USD $' },
    { label: 'Jar started', value: state.jar ? formatStarted(state.jar.startedOn) : JAR_STARTED },
  ];

  // A real jar is solo until the second person joins — /pair says so, and this
  // screen must not claim otherwise one tap away.
  const waiting = Boolean(state.jar && !state.jar.partnerId);

  const exportHistory = async () => {
    setExporting(true);
    setExportError(null);
    try {
      let entries: ExportEntry[];

      if (state.jar) {
        const sb = getSupabase();
        // A real jar cannot exist without a client, but the export must not
        // quietly fall back to state.fines — that is the current jar only.
        if (!sb) throw new Error('Could not export');
        entries = await loadAllFines(sb, state.jar.jarId, state.jar.meId);
        // A refused read comes back as no rows. Fines on screen mean the jar
        // is not empty, whatever the query just said.
        if (entries.length === 0 && state.fines.length > 0) {
          throw new Error('Could not reach the jar');
        }
      } else {
        entries = state.fines.map((fine) => ({ fine, cashedOutAt: null, destination: null }));
      }

      if (entries.length === 0) {
        setExportError('Nothing to export yet.');
        return;
      }

      // The amounts go out unmasked even in Mystery jar. This is your own
      // history, asked for on purpose — not a figure glanced at on screen.
      const csv = toCsv(finesToRows(entries, { me: state.me, partner: state.partner }));
      downloadCsv(filename(new Date()), csv);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Could not export');
    } finally {
      setExporting(false);
    }
  };

  const leave = async () => {
    setSigningOut(true);
    setLeaveError(null);
    try {
      await signOut();
      router.push('/jar');
    } catch (e) {
      // Offline, or an expired session. Stay put and say why, the way the
      // pairing screen does with a refused code.
      setLeaveError(e instanceof Error ? e.message : 'Could not sign out');
    } finally {
      setSigningOut(false);
    }
  };

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

        {waiting ? (
          <button
            type="button"
            className="sj-row"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              padding: '15px 18px',
              background: 'var(--color-accent-2-100)',
              border: '1px solid transparent',
              borderRadius: 26,
              font: 'inherit',
              color: 'inherit',
              textAlign: 'left',
              cursor: 'pointer',
            }}
            onClick={() => router.push('/pair')}
          >
            <span className="sj-dot" style={{ background: 'var(--color-accent-2-600)' }} />
            <span style={{ flex: 1, fontSize: 14 }}>Waiting for {state.partner} to join</span>
            <ChevronRightIcon size={16} style={{ opacity: 0.45 }} />
          </button>
        ) : (
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
            <span className="tag tag-accent-2">
              {state.jar ? `Since ${formatStarted(state.jar.startedOn)}` : 'Since March'}
            </span>
          </div>
        )}

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
          {rows.map((row) => (
            <div key={row.label} className="sj-surface-row sj-row">
              <span style={{ flex: 1, fontSize: 15 }}>{row.label}</span>
              <span className="text-muted" style={{ fontSize: 14 }}>
                {row.value}
              </span>
            </div>
          ))}

          <button
            type="button"
            className="sj-surface-row sj-row"
            disabled={exporting}
            aria-busy={exporting}
            onClick={exportHistory}
          >
            <span style={{ flex: 1, fontSize: 15 }}>Export history</span>
            <span className="text-muted" style={{ fontSize: 14 }}>
              {exporting ? 'Gathering…' : 'CSV'}
            </span>
            <ChevronRightIcon size={16} style={{ opacity: 0.45 }} />
          </button>

          {exportError && (
            <p
              role="alert"
              style={{ fontSize: 13, margin: '2px 2px 0', color: 'var(--color-accent-700)' }}
            >
              {exportError}
            </p>
          )}
        </div>

        {/* Nothing here at all when there is no project to sign in to, and
            nothing until the session is known — a row that flips from "Sign in"
            to an address a beat later reads as a bug. */}
        {configured && auth.ready && (
          <div className="sj-stack">
            {auth.userId ? (
              <>
                <div className="sj-surface-row">
                  <span style={{ flex: 1, fontSize: 15 }}>Signed in</span>
                  <span
                    className="text-muted"
                    style={{
                      fontSize: 14,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {auth.email ?? 'on this phone'}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-block"
                  style={{ height: 46, color: 'var(--color-accent-700)' }}
                  disabled={signingOut}
                  aria-busy={signingOut}
                  onClick={leave}
                >
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
                {leaveError && (
                  <p
                    role="alert"
                    style={{ fontSize: 13, margin: '2px 2px 0', color: 'var(--color-accent-700)' }}
                  >
                    {leaveError}
                  </p>
                )}
              </>
            ) : (
              <button
                type="button"
                className="sj-surface-row sj-row"
                onClick={() => router.push('/signin')}
              >
                <span style={{ flex: 1, fontSize: 15 }}>Sign in</span>
                <span className="text-muted" style={{ fontSize: 14 }}>
                  Makes the jar a real one
                </span>
                <ChevronRightIcon size={16} style={{ opacity: 0.45 }} />
              </button>
            )}
          </div>
        )}

        {/* A real jar lives in Postgres; this would only wipe the copy on this
            phone and leave the two of you disagreeing. */}
        {!remote && (
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
        )}
      </div>
    </div>
  );
}
