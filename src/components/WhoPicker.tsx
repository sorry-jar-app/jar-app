'use client';

/**
 * "Who" — the two-column pill grid shared by Log a fine and One-off, reading
 * and writing the same draft so switching between them keeps the choice.
 *
 * Two people, one choice, so it is a RadioGroup — and now it is one all the
 * way down. A single-select ToggleButtonGroup announced itself as a radiogroup
 * with role="radio" pills, but a toolbar was doing the keyboard work
 * underneath: both pills were tabbable, and an arrow key moved focus without
 * moving the selection, which is not what "radio group, Nick, 1 of 2"
 * promises. RadioGroup renders a real <input type="radio"> per person, so the
 * platform gives the single tab stop and arrow-key selection, and the
 * announcement is true.
 *
 * The draft starts with nobody in it and that is allowed — value takes null.
 * While nothing is chosen both people are tabbable, which is what an unchecked
 * native radio group does too; choosing one collapses the group to one stop.
 *
 * The pills keep .sj-pill. React Aria renders aria-checked, not aria-pressed,
 * and HeroUI's own selected fill is keyed to [data-selected]; the app's is
 * keyed to [data-on], so the flag is passed explicitly and app.css — which
 * loads last — paints the pill.
 */

import { Radio, RadioGroup } from '@heroui/react';
import { useId } from 'react';
import { Avatar } from './Avatar';
import { useStore } from '@/lib/store';
import type { Person } from '@/lib/types';

/* .radio-group is a wrapping flex row at gap-4 when horizontal, and it is only
   full width because .sj-section stretches it. The row it replaces was an
   inline-flex that could not wrap, centred, at 10. Stated in full so it is the
   same row. */
const GROUP: React.CSSProperties = {
  // Two equal columns, as this row has been since the handoff. HeroUI's
  // .toggle-button carried width:fit-content, so the port quietly turned the
  // grid into content-width pills that centre and change width with the names
  // in them. .radio-group is a wrapping flex row at gap-4; stated in full so
  // neither that nor the old inline-flex is left half-applied.
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
}

/* The field wrapper is new — the pill used to be the flex item itself — so it
   has to be transparent. organic.css has a legacy .radio of its own, unlayered
   and therefore ahead of HeroUI's, and its align-items: center would leave the
   pill at its own width inside a wrapper the row had squeezed. Stretch it, and
   let the wrapper shrink so a long name wraps instead of pushing the row. */
const FIELD: React.CSSProperties = {
  // organic.css has an unlayered legacy .radio rule (inline-flex, align-items:
  // center) that matches HeroUI's .radio block and wins. Left alone it would
  // leave the pill at its own width inside a grid cell that is wider.
  display: 'flex',
  alignItems: 'stretch',
  minWidth: 0,
}

/* The pill was fighting .toggle-button's 40px height, centred content and
   nowrap. .radio__content has none of those — it is a relative inline-flex row
   and .sj-pill--who makes it a flex row at gap 10 — so the only thing left to
   say is that it shrinks with the row. */
const PILL: React.CSSProperties = { minWidth: 0, flex: 1, justifyContent: 'center' };

export function WhoPicker() {
  const { state, dispatch } = useStore();
  const { who } = state.draft;
  const labelId = useId();
  const noteId = useId();

  // A real jar is solo until the second person joins, and the database will
  // refuse a fine on someone who is not in it. Offering the choice and then
  // swallowing the fine is worse than not offering it — solo use is supposed
  // to work, so fining yourself still does.
  const soloJar = Boolean(state.jar && !state.jar.partnerId);

  const people: { id: Person; name: string }[] = [
    { id: 'A', name: state.me },
    { id: 'S', name: state.partner },
  ];

  return (
    <div className="sj-section">
      <h6 className="sj-label" id={labelId}>
        Who
      </h6>
      <RadioGroup
        aria-labelledby={labelId}
        orientation="horizontal"
        // The draft starts with nobody in it, and null is how a radio group
        // says that. There is no unchoosing once someone is chosen.
        value={who ?? null}
        onChange={(next) => {
          if (next === 'A' || next === 'S') {
            dispatch({ type: 'draft/patch', patch: { who: next } });
          }
        }}
        style={GROUP}
      >
        {people.map((p) => {
          const on = who === p.id;
          const unavailable = soloJar && p.id === 'S';
          return (
            <Radio
              key={p.id}
              value={p.id}
              isDisabled={unavailable}
              // On the field, not the pill: React Aria hands a field's
              // labelling props to the input, which is the radio. A title
              // never shows on a phone anyway, and the line under the pills
              // says the same thing out loud.
              aria-describedby={unavailable ? noteId : undefined}
              style={FIELD}
            >
              {/* The pill classes belong on Radio.Content: that is the
                  <label>, and the thing you can see and press. Radio is the
                  field wrapper around it. No Radio.Control and no
                  Radio.Indicator — the pill is its own indicator, and an empty
                  16px circle would be sitting inside it next to the avatar. */}
              <Radio.Content className="sj-pill sj-pill--who" data-on={on} style={PILL}>
                {/* flex-shrink:0, or the pill's min-width:0 lets the flex row
                    squeeze a circle into a vertical ellipse when the name is
                    long enough to compete for the space. */}
                <span style={{ flex: 'none', display: 'inline-flex' }}>
                  <Avatar person={p.id} initial={p.name.charAt(0)} inverted={on} />
                </span>
                {p.name}
              </Radio.Content>
            </Radio>
          );
        })}
      </RadioGroup>
      {soloJar && (
        <p className="text-muted" id={noteId} style={{ fontSize: 12, margin: '0 2px' }}>
          {state.partner} has not joined yet — you can still fine yourself.
        </p>
      )}
    </div>
  );
}
