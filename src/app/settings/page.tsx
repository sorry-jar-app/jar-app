'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  Chip,
  Input,
  Label,
  Radio,
  RadioGroup,
  TextField,
} from '@heroui/react';
import { ChevronRightIcon } from '@/components/Icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Toggle } from '@/components/Toggle';
import { JAR_STARTED, THEME_MODES } from '@/lib/constants';
import { downloadCsv, finesToRows, toCsv, type ExportEntry } from '@/lib/csv';
import { getSupabase } from '@/lib/supabase/client';
import { loadAllFines } from '@/lib/supabase/api';
import { formatStarted } from '@/lib/when';
import { useStore } from '@/lib/store';

/**
 * The status dot on the pairing row. The kit has no dot, and this is the only
 * place on the screen that needs one, so it stays a plain span — geometry
 * inline, colour off a theme token.
 */
function StatusDot({ tone }: { tone: 'waiting' | 'paired' }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 8,
        height: 8,
        flexShrink: 0,
        borderRadius: '50%',
        background: tone === 'paired' ? 'var(--success)' : 'var(--muted)',
      }}
    />
  );
}

/** `digi-jar-2026-09-20.csv`, in the phone's own timezone rather than UTC. */
function filename(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `digi-jar-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.csv`;
}

export default function SettingsPage() {
  const router = useRouter();
  const { state, dispatch, auth, configured, remote, signOut } = useStore();
  const [signingOut, setSigningOut] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const modeLabelId = useId();

  const rows: ReadonlyArray<{ label: string; value: string }> = [
    { label: 'Currency', value: 'USD $' },
    { label: 'Jar started', value: state.jar ? formatStarted(state.jar.startedOn) : JAR_STARTED },
  ];

  // A real jar is solo until the second person joins — /pair says so, and this
  // screen must not claim otherwise one tap away.
  const waiting = Boolean(state.jar && !state.jar.partnerId);

  const exportHistory = async () => {
    // The row keeps its focus and its place in the tab order while it works,
    // so the guard has to do what `disabled` used to.
    if (exporting) return;
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
    if (signingOut) return;
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
          <TextField
            value={state.me}
            onChange={(name) => dispatch({ type: 'setName', person: 'A', name })}
          >
            <Label>You</Label>
            <Input />
          </TextField>
          <TextField
            value={state.partner}
            onChange={(name) => dispatch({ type: 'setName', person: 'S', name })}
          >
            <Label>Them</Label>
            <Input />
          </TextField>
        </div>

        {/*
          Light, dark, or the phone's own setting. The Glass theme ships both
          modes, so this is all that is left to choose — and it is per-device,
          because one of you wanting dark says nothing about the other.
        */}
        <div className="sj-section">
          <h6 id={modeLabelId}>Appearance</h6>
          <RadioGroup
            aria-labelledby={modeLabelId}
            orientation="horizontal"
            value={state.mode}
            onChange={(value) => {
              const mode = THEME_MODES.find((m) => m.id === value);
              // The store resolves 'system' and writes data-theme, which is
              // what actually repaints the app.
              if (mode) dispatch({ type: 'setMode', mode: mode.id });
            }}
          >
            {THEME_MODES.map((mode) => (
              <Radio key={mode.id} value={mode.id}>
                <Radio.Content>{mode.name}</Radio.Content>
              </Radio>
            ))}
          </RadioGroup>
        </div>

        {waiting ? (
          <Button variant="secondary" fullWidth onPress={() => router.push('/pair')}>
            <StatusDot tone="waiting" />
            <span style={{ flex: 1, minWidth: 0 }}>Waiting for {state.partner} to join</span>
            <ChevronRightIcon />
          </Button>
        ) : (
          <Card>
            <Card.Content
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <StatusDot tone="paired" />
              <span className="text-sm" style={{ flex: 1, minWidth: 0 }}>
                Paired with {state.partner}
              </span>
              <Chip>
                <Chip.Label>
                  {state.jar ? `Since ${formatStarted(state.jar.startedOn)}` : 'Since March'}
                </Chip.Label>
              </Chip>
            </Card.Content>
          </Card>
        )}

        {/* A real switch now, not a button pretending with aria-pressed. */}
        <Toggle
          on={state.mystery}
          onChange={() => dispatch({ type: 'mystery/toggle' })}
          label="Mystery jar"
          description="Hide the running total until you cash out"
        />

        <div className="sj-stack">
          <Card>
            <Card.Content style={{ gap: 10 }}>
              {rows.map((row) => (
                <div
                  key={row.label}
                  style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <span className="text-sm" style={{ flex: 1, minWidth: 0 }}>
                    {row.label}
                  </span>
                  <span className="text-sm text-muted">{row.value}</span>
                </div>
              ))}
            </Card.Content>
          </Card>

          <Button variant="secondary" fullWidth onPress={() => router.push('/cash-out')}>
            <span style={{ flex: 1, minWidth: 0 }}>Spend the jar</span>
            <ChevronRightIcon />
          </Button>

          {/* aria-busy does not survive HeroUI's Button, and isDisabled would
              render a real `disabled` — which drops the row out of the tab
              order and takes the focus with it, mid-press. The render function
              is the way both attributes get back on. */}
          <Button
            variant="secondary"
            fullWidth
            render={(props) => (
              <button {...props} aria-busy={exporting} aria-disabled={exporting} />
            )}
            onPress={exportHistory}
          >
            <span style={{ flex: 1, minWidth: 0 }}>Export history</span>
            <span className="text-muted">{exporting ? 'Gathering…' : 'CSV'}</span>
            <ChevronRightIcon />
          </Button>

          {exportError && (
            <p
              role="alert"
              className="text-sm"
              style={{ margin: '2px 2px 0', color: 'var(--danger)' }}
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
                <Card>
                  <Card.Content
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
                  >
                    <span className="text-sm" style={{ flex: 1, minWidth: 0 }}>
                      Signed in
                    </span>
                    <span
                      className="text-sm text-muted"
                      style={{
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {auth.email ?? 'on this phone'}
                    </span>
                  </Card.Content>
                </Card>
                <Button
                  variant="ghost"
                  fullWidth
                  render={(props) => (
                    <button {...props} aria-busy={signingOut} aria-disabled={signingOut} />
                  )}
                  onPress={leave}
                >
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </Button>
                {leaveError && (
                  <p
                    role="alert"
                    className="text-sm"
                    style={{ margin: '2px 2px 0', color: 'var(--danger)' }}
                  >
                    {leaveError}
                  </p>
                )}
              </>
            ) : (
              <Button variant="secondary" fullWidth onPress={() => router.push('/signin')}>
                <span style={{ flex: 1, minWidth: 0 }}>Sign in</span>
                <span className="text-muted">Makes the jar a real one</span>
                <ChevronRightIcon />
              </Button>
            )}
          </div>
        )}

        {/* A real jar lives in Postgres; this would only wipe the copy on this
            phone and leave the two of you disagreeing. */}
        {!remote && (
          <Button
            variant="danger-soft"
            fullWidth
            onPress={() => {
              dispatch({ type: 'reset' });
              router.push('/jar');
            }}
          >
            Reset this demo
          </Button>
        )}
      </div>
    </div>
  );
}
