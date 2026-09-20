'use client';

import { Description, Label, Switch } from '@heroui/react';
import type { ReactNode } from 'react';

/**
 * A switch, in the two shapes the app has callers for.
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
 *
 * The track, the thumb, the thumb's travel and the focus ring are the theme's.
 */

const CONTROL = (
  <Switch.Control>
    <Switch.Thumb />
  </Switch.Control>
);

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
  className?: string;
  isDisabled?: boolean;
};

export function Toggle(props: Decorative | Row) {
  const { on } = props;

  if (props.onChange === undefined) {
    return (
      <Switch isSelected={on} isReadOnly style={{ flexShrink: 0 }}>
        {CONTROL}
      </Switch>
    );
  }

  const { className, description, isDisabled, label, onChange } = props;

  return (
    <Switch
      className={className}
      isSelected={on}
      isDisabled={isDisabled}
      onChange={onChange}
      style={{ width: '100%' }}
    >
      {/* Label left, track right, the width of the screen between them. */}
      <Switch.Content style={{ width: '100%', justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
          <Label>{label}</Label>
          {description !== undefined && <Description>{description}</Description>}
        </span>
        {CONTROL}
      </Switch.Content>
    </Switch>
  );
}
