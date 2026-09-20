'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Input,
  Label,
  Radio,
  RadioGroup,
  TextField,
} from '@heroui/react';
import { ChevronRightIcon } from '@/components/Icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Toggle } from '@/components/Toggle';
import { JAR_STARTED, PALETTE_NAMES } from '@/lib/constants';
import { downloadCsv, finesToRows, toCsv, type ExportEntry } from '@/lib/csv';
import { getSupabase } from '@/lib/supabase/client';
import { loadAllFines } from '@/lib/supabase/api';
import { formatStarted } from '@/lib/when';
import { useStore } from '@/lib/store';

/**
 * HeroUI's .button is a 40px-tall (36px above 768px), nowrap control that
 * scales to 97% under a press. A settings row is none of those things: it is
 * as tall as its own padding, it wraps a long partner name, and it does not
 * flinch when touched. The class cannot say so — .button's height is declared
 * at the same specificity as .sj-surface-row, and the scale only exists on
 * :active — so it is said inline, where it wins outright.
 */
const ROW_BUTTON: React.CSSProperties = {
  height: 'auto',
  whiteSpace: 'normal',
  transform: 'none',
};

const CHEVRON: React.CSSProperties = { width: 16, height: 16, margin: 0, opacity: 0.45 };

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
  const paletteLabelId = useId();

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
          {/* .field sits on the TextField root rather than around it:
              `.field > label` needs the label to be a direct child, and
              TextField is the element that wraps them both. */}
          <TextField
            className="field"
            value={state.me}
            onChange={(name) => dispatch({ type: 'setName', person: 'A', name })}
          >
            <Label>You</Label>
            <Input />
          </TextField>
          <TextField
            className="field"
            value={state.partner}
            onChange={(name) => dispatch({ type: 'setName', person: 'S', name })}
          >
            <Label>Them</Label>
            <Input />
          </TextField>
        </div>

        {/* Four palettes, one of them always on — a radiogroup named by the
            heading, and now one in behaviour as well as in markup. A
            ToggleButtonGroup said role="radio" over a toolbar: four tab
            stops, and an arrow key that moved focus without moving the
            selection. RadioGroup wires useRadio instead, so the tab order
            holds exactly one pill — the chosen one — and the arrow keys
            change the palette, because underneath each pill is a real
            <input type="radio">.
            The selected fill is keyed to [data-on] in app.css — 600, because
            the chosen pill carries cream text — so the flag is passed
            explicitly; HeroUI's own [data-selected] fill never gets a look in. */}
        <div className="sj-section">
          <h6 className="sj-label" id={paletteLabelId}>
            Palette
          </h6>
          <RadioGroup
            aria-labelledby={paletteLabelId}
            orientation="horizontal"
            value={state.palette}
            onChange={(value) => {
              const palette = PALETTE_NAMES.find((p) => p === value);
              // The store mirrors this onto <html data-palette>, which is what
              // actually repaints the app.
              if (palette) dispatch({ type: 'setPalette', palette });
            }}
            // .radio-group is a flex column that only its horizontal variant
            // turns back into a wrapping row, and then at 16px. The row is
            // stated outright rather than inherited: the same box the group
            // had before, at the same 7px the filter pills sit at.
            style={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 7,
              width: '100%',
            }}
          >
            {PALETTE_NAMES.map((palette) => (
              <Radio key={palette} value={palette}>
                {/* Radio.Content is the <label> wrapping the hidden input, so
                    the pill has to be Content. On Radio itself it would paint
                    a box beside the control rather than be the control. No
                    Radio.Control or Radio.Indicator: the pill is the
                    indicator, and an empty control would draw a second one. */}
                <Radio.Content
                  className="sj-pill sj-pill--filter"
                  data-on={state.palette === palette}
                  style={({ isFocusVisible }) => ({
                    // .radio__content declares neither, and a pill is as tall
                    // as its own padding and does not break a palette name.
                    height: 'auto',
                    whiteSpace: 'nowrap',
                    // Focus now sits on the 1px input inside this label, where
                    // organic.css's global :focus-visible outline is drawn but
                    // cannot be seen. Put the same 2px accent back on the pill
                    // — with arrow keys moving the selection, where you are
                    // has to be visible.
                    outline: isFocusVisible ? '2px solid var(--color-accent)' : undefined,
                    outlineOffset: isFocusVisible ? 2 : undefined,
                  })}
                >
                  {palette}
                </Radio.Content>
              </Radio>
            ))}
          </RadioGroup>
        </div>

        {waiting ? (
          <Button
            className="sj-row"
            variant="ghost"
            style={{
              ...ROW_BUTTON,
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
            onPress={() => router.push('/pair')}
          >
            <span className="sj-dot" style={{ background: 'var(--color-accent-2-600)' }} />
            <span style={{ flex: 1, fontSize: 14 }}>Waiting for {state.partner} to join</span>
            <ChevronRightIcon size={16} style={{ ...CHEVRON, color: 'inherit' }} />
          </Button>
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

        {/* A real switch now, not a button pretending with aria-pressed. */}
        <Toggle
          on={state.mystery}
          onChange={() => dispatch({ type: 'mystery/toggle' })}
          label="Mystery jar"
          description="Hide the running total until you cash out"
        />

        <div className="sj-stack">
          {rows.map((row) => (
            <div key={row.label} className="sj-surface-row sj-row">
              <span style={{ flex: 1, fontSize: 15 }}>{row.label}</span>
              <span className="text-muted" style={{ fontSize: 14 }}>
                {row.value}
              </span>
            </div>
          ))}

          <Button
            className="sj-surface-row sj-row"
            variant="ghost"
            style={ROW_BUTTON}
            onPress={() => router.push('/cash-out')}
          >
            <span style={{ flex: 1, fontSize: 15 }}>Spend the jar</span>
            <ChevronRightIcon size={16} style={{ ...CHEVRON, color: 'inherit' }} />
          </Button>

          {/* aria-busy does not survive HeroUI's Button, and isDisabled would
              render a real `disabled` — which drops the row out of the tab
              order and takes the focus with it, mid-press. The render function
              is the way both attributes get back on. */}
          <Button
            className="sj-surface-row sj-row"
            variant="ghost"
            style={ROW_BUTTON}
            render={(props) => (
              <button {...props} aria-busy={exporting} aria-disabled={exporting} />
            )}
            onPress={exportHistory}
          >
            <span style={{ flex: 1, fontSize: 15 }}>Export history</span>
            <span className="text-muted" style={{ fontSize: 14 }}>
              {exporting ? 'Gathering…' : 'CSV'}
            </span>
            <ChevronRightIcon size={16} style={{ ...CHEVRON, color: 'inherit' }} />
          </Button>

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
                <Button
                  className="btn btn-ghost btn-block"
                  variant="ghost"
                  style={{ height: 46, color: 'var(--color-accent-700)' }}
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
                    style={{ fontSize: 13, margin: '2px 2px 0', color: 'var(--color-accent-700)' }}
                  >
                    {leaveError}
                  </p>
                )}
              </>
            ) : (
              <Button
                className="sj-surface-row sj-row"
                variant="ghost"
                style={ROW_BUTTON}
                onPress={() => router.push('/signin')}
              >
                <span style={{ flex: 1, fontSize: 15 }}>Sign in</span>
                <span className="text-muted" style={{ fontSize: 14 }}>
                  Makes the jar a real one
                </span>
                <ChevronRightIcon size={16} style={{ ...CHEVRON, color: 'inherit' }} />
              </Button>
            )}
          </div>
        )}

        {/* A real jar lives in Postgres; this would only wipe the copy on this
            phone and leave the two of you disagreeing. */}
        {!remote && (
          <Button
            className="btn btn-ghost btn-block"
            variant="ghost"
            style={{ height: 46, color: 'var(--color-accent-700)' }}
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
