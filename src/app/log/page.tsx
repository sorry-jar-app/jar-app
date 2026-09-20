'use client';

/**
 * Log a fine — who, what, how bad, commit.
 *
 * The draft lives in the store rather than local state so "Something else"
 * can hand the same who/ruleId over to /log/one-off and back.
 *
 * The three choices are three real widgets rather than three piles of
 * aria-pressed buttons:
 *
 *   Who            RadioGroup         (in WhoPicker)
 *   What happened  ListBox            role=listbox / role=option
 *   How bad        RadioGroup         role=radiogroup / role=radio
 *
 * Each collapses to one tab stop with arrow keys inside it, and each is named
 * by the h6 that already sits above it. The screen went from eight tab stops
 * to four.
 *
 * Selection is shown the kit's way: ListBox.ItemIndicator on a rule row, and
 * Radio.Control/Radio.Indicator on a severity. Nothing here paints.
 */

import { Button, Description, Form, Label, ListBox, Radio, RadioGroup } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { useId } from 'react';
import { ChevronRightIcon } from '@/components/Icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { WhoPicker } from '@/components/WhoPicker';
import { SEVERITIES } from '@/lib/constants';
import { money, parseAmount } from '@/lib/money';
import { useStore } from '@/lib/store';

/* An equal share of the row for each severity, so three options divide the
   width instead of bunching at the start. Geometry, not decoration. */
const OPTION: React.CSSProperties = { flex: 1 };

/* The price sits at the far end of the row; the kit's item is a
   justify-start flex line. */
const PRICE: React.CSSProperties = { marginInlineStart: 'auto' };

/* Label on the left, the One-off hint on the right — the same shape as the
   rule rows above it. .button centres its content, which is right for every
   other button in the app and wrong for a row. */
const ROW: React.CSSProperties = { justifyContent: 'space-between' };

export default function LogFinePage() {
  const router = useRouter();
  const { state, dispatch } = useStore();
  const { who, ruleId, sev, customAmt } = state.draft;
  const whatId = useId();
  const howBadId = useId();

  const isCustom = ruleId === 'custom';
  const rule = state.rules.find((r) => r.id === ruleId) ?? null;
  const mult = SEVERITIES.find((s) => s.id === sev)?.mult ?? 1;
  // Rounded the way the reducer rounds it, so the CTA never promises a figure
  // a cent away from the one that lands. A draft returned from /log/one-off
  // keeps its exact amount, so this screen can still commit it.
  const pending = isCustom
    ? parseAmount(customAmt)
    : rule
      ? Math.round(rule.price * mult * 100) / 100
      : 0;
  const ready = Boolean(who) && (isCustom ? pending > 0 : rule !== null);

  // The CTA is the form's submit button, so this runs for a press and for any
  // other route to submission a browser may offer. The gate is repeated here
  // rather than trusted to the disabled button: this is the only path in the
  // app that moves money.
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ready) return;
    dispatch({ type: 'fine/submit' });
    router.replace('/landed');
  };

  const goOneOff = () => {
    dispatch({ type: 'draft/patch', patch: { ruleId: 'custom' } });
    router.push('/log/one-off');
  };

  return (
    <Form className="sj-screen sj-screen--pushed" onSubmit={submit}>
      <ScreenHeader title="Log a fine" backTo="/jar" />

      <div className="sj-body" style={{ padding: '4px 24px 18px', gap: 20 }}>
        <WhoPicker />

        <div className="sj-section">
          <h6 className="sj-label" id={whatId}>
            What happened
          </h6>
          <ListBox
            aria-labelledby={whatId}
            // Nothing stops you deleting every rule — rule/delete has no floor
            // and create_jar only seeds three. Without this the list is still a
            // tab stop: zero children, zero height, and a focus ring drawn
            // across the screen under a heading that now names nothing.
            renderEmptyState={() => (
              <p className="text-muted" style={{ margin: 0 }}>
                No rules yet. Something else, then.
              </p>
            )}
            selectionMode="single"
            disallowEmptySelection
            // A draft carrying 'custom' came back from One-off and matches no
            // rule, which is the same nothing-selected state the screen starts
            // in. Leaving the list empty says so.
            selectedKeys={ruleId !== null && ruleId !== 'custom' ? [ruleId] : []}
            onSelectionChange={(keys) => {
              if (keys === 'all') return;
              const [next] = [...keys];
              if (typeof next === 'string') {
                dispatch({ type: 'draft/patch', patch: { ruleId: next } });
              }
            }}
          >
            {state.rules.map((r) => (
              // .sj-row is behaviour, not paint: it kills the tap delay and the
              // iOS long-press callout on a control a thumb lands on all day.
              <ListBox.Item key={r.id} id={r.id} textValue={r.name} className="sj-row">
                <Label>{r.name}</Label>
                <span style={PRICE}>{money(r.price)}</span>
                {/* The kit shows selection here. .list-box-item leaves
                    [data-selected] unpainted and reserves the end padding for
                    this checkmark instead. */}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
          {/* Not a listbox option: it picks nothing, it leaves for another
              screen. Keeping it outside the list is what stops a rule and a
              route sharing one set of arrow keys. */}
          <Button className="sj-row" variant="ghost" fullWidth style={ROW} onPress={goOneOff}>
            <span>Something else</span>
            <span className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              One-off
              <ChevronRightIcon />
            </span>
          </Button>
        </div>

        <div className="sj-section">
          <h6 className="sj-label" id={howBadId}>
            How bad
          </h6>
          <RadioGroup
            aria-labelledby={howBadId}
            orientation="horizontal"
            // disallowEmptySelection has nothing left to guard. Draft.sev is
            // Exclude<Severity, 'one-off'> and starts at 'bad', so one of the
            // three is always the value, and a radio cannot be unpicked by
            // pressing it the way a toggle could. Worth keeping true: React
            // Aria hands the tab stop to the selected radio, so a value
            // matching none of them would leave the group with no tab stop
            // at all.
            value={sev}
            onChange={(next) => {
              const opt = SEVERITIES.find((s) => s.id === next);
              if (opt) dispatch({ type: 'draft/patch', patch: { sev: opt.id } });
            }}
          >
            {SEVERITIES.map((s) => (
              <Radio key={s.id} value={s.id} style={OPTION}>
                <Radio.Content>
                  {/* The kit's own selected state. Without Control and
                      Indicator a Radio.Content is unpainted text — there would
                      be nothing on screen saying which severity is picked. */}
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
                  {s.name}
                </Radio.Content>
                {/* A sibling of Content, which is how the kit wires a per-radio
                    description into aria-describedby. */}
                <Description>×{s.mult}</Description>
              </Radio>
            ))}
          </RadioGroup>
        </div>

        <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>
          Fines are final once logged. Take it up with each other, not the app.
        </p>
      </div>

      <div className="sj-footer">
        <Button type="submit" size="lg" fullWidth isDisabled={!ready}>
          {ready ? `Add ${money(pending)} to the jar` : 'Pick who and what'}
        </Button>
      </div>
    </Form>
  );
}
