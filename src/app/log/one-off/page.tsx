'use client';

/**
 * One-off fine — a fine that is not a rule, at an exact price.
 *
 * No severity section: the amount is already the amount. Severity is recorded
 * as 'one-off' by the reducer.
 *
 * The screen is a real <form>, which is what makes the phone keyboard's return
 * key commit the fine from either text field. The CTA is its submit button, so
 * an unready draft cannot be submitted that way either.
 *
 * The quick amounts are a real RadioGroup, which puts a native radio input in
 * that form for each of them. That is the point of the conversion: it is what
 * buys one tab stop and arrow keys that select rather than only travel. Enter
 * from one of them submits the form, which is what Enter from either text
 * field already did, and the same fine either way. The keydown guard on
 * .sj-body is still about the switch and nothing else.
 */

import { Button, Form, Input, Radio, RadioGroup, TextField } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { AmountField } from '@/components/AmountField';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Toggle } from '@/components/Toggle';
import { WhoPicker } from '@/components/WhoPicker';
import { money, parseAmount } from '@/lib/money';
import { useStore } from '@/lib/store';

const QUICK_AMOUNTS = [1, 2, 5, 10];

/*
 * The quick amounts, on HeroUI's terms.
 *
 * A single-select ToggleButtonGroup wrote radiogroup and radio into the markup
 * and was a toolbar underneath: every pill tabbable, and an arrow key that
 * moved focus without moving the selection. RadioGroup wires the real thing —
 * the selected radio is the only tab stop, and the arrows select, because
 * underneath each pill is a native radio input.
 *
 * Most of what this block used to say went with the toggle button.
 * .toggle-button was a fixed 40px control that painted its own fills, so the
 * height and the radius had to be pinned back. .radio__content is none of
 * that — no height, no background, no radius, and HeroUI paints selection on
 * .radio__control, which this group does not render — so .sj-pill and
 * .sj-pill[data-on='true'] are left to do the whole job unopposed.
 */

/* .radio-group is a wrapping flex row at gap-4 when horizontal. The row it
   replaces filled the width, could not wrap, and sat at 8. Stated in full so
   it is the same row; display:flex is block-level inside the column that is
   .sj-section, which is what fullWidth was for. */
const QUICK_ROW: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'nowrap',
  alignItems: 'center',
  gap: 8,
};

/* Four equal shares of that row. organic.css:165 still has the app's legacy
   .radio — inline-flex, centred — and it is unlayered, so it beats HeroUI's
   own .radio: left alone, each option shrinks to its text and the pill inside
   it is centred rather than filling the share it was given. */
const QUICK_OPTION: React.CSSProperties = { display: 'flex', flex: 1, alignItems: 'stretch' };

/*
 * Two things the classes cannot say, and the ring.
 *
 * justify-content, because .toggle-button centred its own label and
 * .radio__content does not. app.css sets text-align, which does nothing for a
 * bare figure sitting in a flex box that is wider than it is.
 *
 * white-space, because .toggle-button carried `whitespace-nowrap` and
 * .radio__content does not, and app.css never gives .sj-pill one.
 *
 * And the focus ring, because the box that takes focus is no longer the box
 * you can see. The real target is the native input, and organic.css:166 has
 * it at opacity 0 — a ring drawn there is a ring drawn on nothing. HeroUI
 * rings .radio__control instead, which this group omits. So the ring is asked
 * for here, on the pill, in the app's own terms, which is where it sat when
 * the pill was a button.
 */
function quickPillStyle({ isFocusVisible }: { isFocusVisible: boolean }): React.CSSProperties {
  return {
    justifyContent: 'center',
    whiteSpace: 'nowrap',
    ...(isFocusVisible ? { outline: '2px solid var(--color-accent)', outlineOffset: 2 } : null),
  };
}

export default function OneOffFinePage() {
  const router = useRouter();
  const { state, dispatch } = useStore();
  const { who, ruleId, customName, customAmt, saveAsRule } = state.draft;
  const whatId = useId();
  const howMuchId = useId();

  // Reaching this screen at all means the fine is a one-off, including on a
  // direct visit or a reload that never passed through /log. Stop re-arming
  // once submitted, though: the reducer empties the draft while this page is
  // still mounted, and re-arming would leave a half-set draft behind.
  const submitted = useRef(false);
  useEffect(() => {
    if (submitted.current) return;
    if (ruleId !== 'custom') dispatch({ type: 'draft/patch', patch: { ruleId: 'custom' } });
  }, [ruleId, dispatch]);

  const amt = parseAmount(customAmt);
  const ready = Boolean(who) && amt > 0;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ready) return;
    submitted.current = true;
    dispatch({ type: 'fine/submit' });
    router.replace('/landed');
  };

  return (
    <Form className="sj-screen sj-screen--pushed" onSubmit={submit}>
      <ScreenHeader title="One-off fine" backTo="/log" />

      <div
        className="sj-body"
        style={{ padding: '4px 24px 18px', gap: 20 }}
        // React Aria deliberately lets Enter fall through a checkbox to
        // implicit form submission rather than toggling it. That is the right
        // default almost everywhere and the wrong one here: the only checkbox
        // on this screen is "Save as a rule", and the submission it falls
        // through to logs the fine. Space would set a preference and Enter
        // would move money, on the same control. Caught on the way up — a
        // cancelled default is still cancelled — so Enter does nothing there
        // instead, which is the safe way to be wrong.
        onKeyDown={(e: ReactKeyboardEvent<HTMLDivElement>) => {
          const el = e.target as HTMLElement | null;
          if (e.key === 'Enter' && el?.getAttribute('role') === 'switch') e.preventDefault();
        }}
      >
        <WhoPicker />

        {/* .textfield is a 4px-gap column and .sj-section is a 10px one, so the
            field owns the section outright rather than sitting in a wrapper.
            The h6 names the input by reference: one string, not two that can
            drift. */}
        <TextField
          className="sj-section"
          aria-labelledby={whatId}
          value={customName}
          onChange={(value) => dispatch({ type: 'draft/patch', patch: { customName: value } })}
        >
          <h6 className="sj-label" id={whatId}>
            What happened
          </h6>
          <Input
            className="input"
            style={{ height: 48, fontSize: 15 }}
            placeholder="Ate my leftovers"
          />
        </TextField>

        <div className="sj-section">
          {/* The heading names the group below it, the way "How bad" names
              the severities on /log. One string, not two that can drift. */}
          <h6 className="sj-label" id={howMuchId}>
            How much
          </h6>
          {/* Not a NumberField. The store holds the raw string the user typed
              and parseAmount reads it at the last moment; a NumberField holds a
              number and would normalise "2." on the keystroke after the dot. */}
          <AmountField
            value={customAmt}
            onChange={(value) => dispatch({ type: 'draft/patch', patch: { customAmt: value } })}
            label="Amount"
          />
          <RadioGroup
            aria-labelledby={howMuchId}
            orientation="horizontal"
            // Typing a figure by hand leaves none of them lit, which is the
            // state the screen opens in, so empty selection is allowed: null
            // is what react-stately holds for nothing chosen.
            value={QUICK_AMOUNTS.includes(amt) ? String(amt) : null}
            onChange={(next) => dispatch({ type: 'draft/patch', patch: { customAmt: next } })}
            style={QUICK_ROW}
          >
            {QUICK_AMOUNTS.map((v) => (
              // The pill classes belong on Radio.Content: that is the <label>
              // wrapping the input, and the thing you can see and press. Radio
              // is the field wrapper around it. No Radio.Control and no
              // Radio.Indicator — the pill is its own indicator, and an empty
              // 16px circle would be sitting inside it.
              //
              // React Aria renders aria-checked, not aria-pressed, so the fill
              // is driven by data-on, which .sj-pill[data-on='true'] already
              // has in app.css.
              <Radio key={v} value={String(v)} style={QUICK_OPTION}>
                <Radio.Content
                  className="sj-pill sj-pill--quick"
                  data-on={amt === v}
                  style={quickPillStyle}
                >
                  ${v}
                </Radio.Content>
              </Radio>
            ))}
          </RadioGroup>
        </div>

        <Toggle
          on={saveAsRule}
          onChange={(next) => dispatch({ type: 'draft/patch', patch: { saveAsRule: next } })}
          label="Save as a rule"
          description="Keep it in the list for next time"
        />
      </div>

      <div className="sj-footer">
        <Button
          type="submit"
          variant="primary"
          className="btn btn-primary btn-block"
          style={{ height: 54, fontSize: 17, marginTop: 0 }}
          isDisabled={!ready}
        >
          {ready ? `Add ${money(amt)} to the jar` : 'Add an amount'}
        </Button>
      </div>
    </Form>
  );
}
