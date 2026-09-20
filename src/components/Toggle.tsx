'use client';

import { Switch } from '@heroui/react';
import type { CSSProperties, ReactNode } from 'react';

/**
 * The 46x27 track and its knob, on HeroUI's Switch.
 *
 * Two shapes, because the app has two kinds of caller.
 *
 *   <Toggle on={x} />                       the track alone, for a row that
 *                                           already owns its own button
 *   <Toggle on={x} onChange={f} label=… />  the whole row, as a real switch
 *
 * The second is the one to reach for. It renders role="switch" with the label
 * wired to it, Space and Enter, and a focus ring — everything a
 * <button aria-pressed> with a decorative track beside it has to fake.
 *
 * The first exists because Switch.Content is a <label> holding a checkbox, and
 * interactive content cannot sit inside a <button>. A Switch with no Content —
 * just Control and Thumb — is still a real HeroUI Switch, styled and driven by
 * data-selected, but it has nothing focusable in it, so it is safe inside the
 * row buttons the screens still use. Those rows can move to the row shape one
 * at a time; nothing has to change at once.
 */

/* The prototype's geometry. HeroUI's md control is 40x20 with an oval thumb;
   this app's is 46x27 with a 21px circle, and app.css cannot be edited from
   here, so the numbers are inline. They beat the class either way. */
const TRACK: CSSProperties = { width: 46, height: 27, borderRadius: 999, flexShrink: 0 };

const KNOB: CSSProperties = {
  width: 21,
  height: 21,
  borderRadius: '50%',
  background: 'var(--color-bg)',
  boxShadow: 'var(--shadow-sm)',
};

/* THE CONTRAST RULE, the other half of it. HeroUI's switch fills the track
   from --accent, which the bridge pins to the 600 step because --accent is a
   surface for cream text. A toggle track carries no text, so it takes the 500
   step — the handoff is explicit that coins, chart bars and toggle tracks are
   the 500's whole job. Hover holds the same value: the prototype's track does
   not lighten under a pointer. */
const TRACK_COLOURS = {
  '--switch-control-bg': 'var(--color-neutral-300)',
  '--switch-control-bg-hover': 'var(--color-neutral-300)',
  '--switch-control-bg-checked': 'var(--color-accent-500)',
  '--switch-control-bg-checked-hover': 'var(--color-accent-500)',
} as CSSProperties;

type Common = { on: boolean };

type Decorative = Common & {
  onChange?: never;
  label?: never;
  description?: never;
  className?: never;
  isDisabled?: never;
};

type Row = Common & {
  onChange: (next: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  /** Appended to .sj-toggle-row, not a replacement for it. */
  className?: string;
  isDisabled?: boolean;
};

export function Toggle(props: Decorative | Row) {
  const { on } = props;

  /* The thumb travels on margin, which is what HeroUI animates — 3px at rest,
     22px across, the prototype's two positions. */
  const control = (
    <Switch.Control style={{ ...TRACK, ...TRACK_COLOURS }}>
      <Switch.Thumb style={{ ...KNOB, marginInlineStart: on ? 22 : 3 }} />
    </Switch.Control>
  );

  if (props.onChange === undefined) {
    return (
      <Switch isSelected={on} isReadOnly style={{ flexShrink: 0 }}>
        {control}
      </Switch>
    );
  }

  const { className, description, isDisabled, label, onChange } = props;

  return (
    <Switch isSelected={on} isDisabled={isDisabled} onChange={onChange} style={{ width: '100%' }}>
      <Switch.Content
        className={className ? `sj-toggle-row ${className}` : 'sj-toggle-row'}
        data-on={on}
        // The row, not the track, is what the eye follows, so the ring stays on
        // the row — where it is today, on the button this replaces.
        style={({ isFocusVisible }) =>
          isFocusVisible
            ? { outline: '2px solid var(--color-accent)', outlineOffset: 2 }
            : {}
        }
      >
        <span style={{ flex: 1 }}>
          <span style={{ fontSize: 15, display: 'block' }}>{label}</span>
          {description !== undefined && (
            <span className="text-muted" style={{ fontSize: 12 }}>
              {description}
            </span>
          )}
        </span>
        {control}
      </Switch.Content>
    </Switch>
  );
}
