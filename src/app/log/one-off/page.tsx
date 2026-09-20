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

/* Four equal shares of the row, so the amounts divide the width instead of
   bunching at the start. Geometry, not decoration. */
const OPTION: React.CSSProperties = { flex: 1 };

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

        {/* The field is its own section: .textfield is already the column that
            holds a heading over an input, so there is no wrapper. The h6 names
            the input by reference — one string, not two that can drift. */}
        <TextField
          fullWidth
          aria-labelledby={whatId}
          value={customName}
          onChange={(value) => dispatch({ type: 'draft/patch', patch: { customName: value } })}
        >
          <h6 className="sj-label" id={whatId}>
            What happened
          </h6>
          <Input placeholder="Ate my leftovers" />
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
          >
            {QUICK_AMOUNTS.map((v) => (
              <Radio key={v} value={String(v)} style={OPTION}>
                <Radio.Content>
                  {/* The kit's own selected state. Without Control and
                      Indicator a Radio.Content is unpainted text — there would
                      be nothing on screen saying which amount is picked. */}
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
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
        <Button type="submit" size="lg" fullWidth isDisabled={!ready}>
          {ready ? `Add ${money(amt)} to the jar` : 'Add an amount'}
        </Button>
      </div>
    </Form>
  );
}
