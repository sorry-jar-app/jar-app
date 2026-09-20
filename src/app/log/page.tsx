'use client';

/**
 * Log a fine — who, what, how bad, commit.
 *
 * The draft lives in the store rather than local state so "Something else"
 * can hand the same who/ruleId over to /log/one-off and back.
 *
 * On HeroUI the three choices are three real widgets rather than three piles
 * of aria-pressed buttons:
 *
 *   Who            RadioGroup         (in WhoPicker)
 *   What happened  ListBox            role=listbox / role=option
 *   How bad        RadioGroup         role=radiogroup / role=radio
 *
 * Each collapses to one tab stop with arrow keys inside it, and each is named
 * by the h6 that already sits above it. The screen went from eight tab stops
 * to four.
 *
 * How bad was a ToggleButtonGroup, which is the radiogroup role laid over a
 * toolbar keyboard model: every option tabbable, and arrow keys that move
 * focus without moving selection. The markup promised a pattern it did not
 * implement. RadioGroup is that pattern — one tabbable radio, and a native
 * input behind each pill, so an arrow key picks as well as travels.
 */

import { Button, Form, ListBox, Radio, RadioGroup } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { useId } from 'react';
import { ChevronRightIcon } from '@/components/Icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { WhoPicker } from '@/components/WhoPicker';
import { SEVERITIES } from '@/lib/constants';
import { money, parseAmount } from '@/lib/money';
import { useStore } from '@/lib/store';

/* .list-box is a padded block that puts 4px between its children and clips
   overflow. The rule stack is a flush 10px column, and a focus ring on the
   last row must not be cut off. */
const RULE_LIST: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 0,
  overflow: 'visible',
};

/* .list-box > * + * adds the 4px on top of the gap above. */
const RULE_ROW: React.CSSProperties = { marginTop: 0 };

/* The group was an inline-flex row: full width, centred, 8px gap. .radio-group
   is a column that data-orientation="horizontal" turns into a wrapping row at
   gap 16, so the gap and the nowrap are said back. Width is not — .radio-group
   is a block-level flex box and .sj-section stretches it to the same place the
   old w-fit + w-full landed. */
const SEV_GROUP: React.CSSProperties = {
  flexWrap: 'nowrap',
  alignItems: 'center',
  gap: 8,
};

/* organic.css:165 still carries a legacy `.radio` — inline-flex, 8px gap, 14px
   — from the app's own hand-rolled radios. It is unlayered, so it beats
   HeroUI's .radio block. Here the field wrapper is not a control, it is the
   third of the row the pill has to fill, so the flex is stated outright rather
   than left to whichever of the two wins. */
const SEV_OPTION: React.CSSProperties = { display: 'flex', flex: 1 };

/* .sj-pill--sev states display, direction, alignment, gap, padding, radius and
   size, and unlayered app CSS beats @layer components on each of them. That
   leaves width: .radio__content shrink-wraps, so the pill is told to fill its
   third — the flex-1 the group's fullWidth used to hand the button.

   The height, radius and white-space that used to sit here went with the
   button. .toggle-button forced 40px, rounded-3xl and nowrap; .radio__content
   forces none of the three, so restating them would be noise. */
const SEV_PILL: React.CSSProperties = { flex: 1 };

/* .sj-pill--rule is a full-width space-between row; .button is a centred,
   fixed-height, fit-width one. Height and width are the two it cannot take
   from the class. */
const ONE_OFF_ROW: React.CSSProperties = { height: 'auto', width: '100%' };

/* .button resizes its svg children to 20px and nudges them with a margin. */
const CHEVRON: React.CSSProperties = { width: 15, height: 15, margin: 0 };

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
            // tab stop: zero children, zero height, and the global
            // :focus-visible draws a 2px line across the screen under a
            // heading that now names nothing.
            renderEmptyState={() => (
              <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
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
            style={RULE_LIST}
          >
            {state.rules.map((r) => (
              <ListBox.Item
                key={r.id}
                id={r.id}
                textValue={r.name}
                className="sj-pill sj-pill--rule sj-row"
                // HeroUI paints selection from [data-selected]; app.css paints
                // it from [data-on]. Both are true, only one is styled here.
                data-on={ruleId === r.id}
                style={RULE_ROW}
              >
                <span>{r.name}</span>
                <span className="sj-money" style={{ fontSize: 15 }}>
                  {money(r.price)}
                </span>
              </ListBox.Item>
            ))}
          </ListBox>
          {/* Not a listbox option: it picks nothing, it leaves for another
              screen. Keeping it outside the list is what stops a rule and a
              route sharing one set of arrow keys. */}
          <Button
            className="sj-pill sj-pill--rule sj-row"
            variant="ghost"
            style={ONE_OFF_ROW}
            onPress={goOneOff}
          >
            <span>Something else</span>
            <span
              style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, opacity: 0.7 }}
            >
              One-off
              <ChevronRightIcon size={15} style={CHEVRON} />
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
            style={SEV_GROUP}
          >
            {SEVERITIES.map((s) => (
              <Radio key={s.id} value={s.id} style={SEV_OPTION}>
                {/* Radio.Content is the label wrapped around the hidden input,
                    so the pill is the label: classes, fill and the whole hit
                    area belong here. No Control and no Indicator — the pill is
                    the indicator, and an empty 16px circle would sit inside
                    it. */}
                <Radio.Content
                  className="sj-pill sj-pill--sev"
                  // HeroUI paints selection from [data-selected]; app.css
                  // paints it from [data-on]. aria-pressed went with the
                  // button and app.css has no aria-checked selector.
                  data-on={sev === s.id}
                  style={SEV_PILL}
                >
                  <span>{s.name}</span>
                  <span style={{ fontSize: 11, opacity: 0.7 }}>×{s.mult}</span>
                </Radio.Content>
              </Radio>
            ))}
          </RadioGroup>
        </div>

        <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>
          Fines are final once logged. Take it up with each other, not the app.
        </p>
      </div>

      <div className="sj-footer">
        <Button
          type="submit"
          variant="primary"
          className="btn btn-primary btn-block"
          style={{ height: 54, fontSize: 17, marginTop: 0 }}
          isDisabled={!ready}
        >
          {ready ? `Add ${money(pending)} to the jar` : 'Pick who and what'}
        </Button>
      </div>
    </Form>
  );
}
