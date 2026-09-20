'use client';

/**
 * "Who" — the two-person picker shared by Log a fine and One-off, reading and
 * writing the same draft so switching between them keeps the choice.
 *
 * Two people, one choice, so it is a RadioGroup — and it is one all the way
 * down. A single-select ToggleButtonGroup announced itself as a radiogroup
 * with role="radio" options, but a toolbar was doing the keyboard work
 * underneath: both were tabbable, and an arrow key moved focus without moving
 * the selection, which is not what "radio group, Nick, 1 of 2" promises.
 * RadioGroup renders a real <input type="radio"> per person, so the platform
 * gives the single tab stop and arrow-key selection, and the announcement is
 * true.
 *
 * The draft starts with nobody in it and that is allowed — value takes null.
 * While nothing is chosen both people are tabbable, which is what an unchecked
 * native radio group does too; choosing one collapses the group to one stop.
 *
 * Radio.Control is the kit's own selection indicator and is what makes the
 * choice visible; the avatar beside it carries the person's colour.
 */

import { Radio, RadioGroup } from '@heroui/react';
import { useId } from 'react';
import { Avatar } from './Avatar';
import { useStore } from '@/lib/store';
import type { Person } from '@/lib/types';

/* Two equal columns. The group is a wrapping flex row by default; the pair has
   been a grid since the handoff so the two names line up whatever their
   length. The gap between them is the theme's. */
const GROUP: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr' };

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
          const unavailable = soloJar && p.id === 'S';
          return (
            <Radio
              key={p.id}
              value={p.id}
              isDisabled={unavailable}
              // On the field, not the content: React Aria hands a field's
              // labelling props to the input, which is the radio. The line
              // under the pair says the same thing out loud.
              aria-describedby={unavailable ? noteId : undefined}
              // Lets a long name wrap rather than push the column wider.
              style={{ minWidth: 0 }}
            >
              <Radio.Content>
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                <Avatar person={p.id} initial={p.name.charAt(0)} />
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
