'use client';

/**
 * Cash out — pick where the jar goes, then empty it.
 *
 * The total seals under Mystery jar; the CTA's figure does not, because the
 * prototype swaps the whole label for "Cash out and reveal" the moment Mystery
 * jar is on, Peek or no Peek.
 *
 * This screen IS the confirmation for a destructive, unreversible action — the
 * footnote under the CTA says so — which is why the CTA still sits behind a
 * deliberate trip from the jar and nothing here fires on a stray tap.
 *
 * The destinations were four `aria-pressed` buttons, which is single-select
 * wearing a toggle's clothes: four tab stops, no arrow keys, and no group to
 * belong to. They are a real RadioGroup now, named by the "Where's it going"
 * heading: one tab stop, arrows between the four, and the kit draws the rows.
 */

import { Button, Description, Radio, RadioGroup } from '@heroui/react';
import { startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ScreenHeader } from '@/components/ScreenHeader';
import { DESTINATIONS } from '@/lib/constants';
import { money, veil } from '@/lib/money';
import { sumFines, useStore } from '@/lib/store';

export default function CashOutPage() {
  const router = useRouter();
  const { state, dispatch, sealed } = useStore();

  const total = sumFines(state.fines);
  // An empty jar has nothing to spend, and cashing it out would write a $0 row
  // into the lifetime history for no reason.
  const empty = state.fines.length === 0;

  function handleCashOut() {
    if (empty) return;
    // Picked at click time, not during render: a random number in the render
    // pass would differ between the server HTML and the first client pass.
    const pick = Math.floor(Math.random() * 3);
    // One transition for both. Dispatching urgently would repaint this screen
    // from the emptied store — $0.00, "0 fines, all forgiven" — in the gap
    // before /cashed-out mounts.
    startTransition(() => {
      dispatch({ type: 'cashout', pick });
      router.replace('/cashed-out');
    });
  }

  return (
    <div className="sj-screen sj-screen--pushed">
      <ScreenHeader title="Spend the jar" backTo="/jar" tight />

      <div className="sj-body" style={{ padding: '14px 24px 18px', gap: 16 }}>
        <div style={{ textAlign: 'center', padding: '20px 0 4px' }}>
          <div className="sj-money" style={{ fontSize: 56, lineHeight: 1 }}>
            {veil(total, sealed)}
          </div>
          <div className="text-muted" style={{ fontSize: 13 }}>
            {state.fines.length} fines, all forgiven
          </div>
        </div>

        <div className="sj-section" style={{ gap: 9 }}>
          <h6 className="sj-label" id="cashout-dest">
            Where&apos;s it going
          </h6>
          <RadioGroup
            aria-labelledby="cashout-dest"
            value={state.dest}
            onChange={(dest) => dispatch({ type: 'dest/set', dest })}
          >
            {DESTINATIONS.map((d) => (
              <Radio key={d.id} value={d.id}>
                <Radio.Content>
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    {d.name}
                    <Description>{d.note}</Description>
                  </span>
                </Radio.Content>
              </Radio>
            ))}
          </RadioGroup>
        </div>
      </div>

      <div className="sj-footer">
        {/* aria-disabled, not isDisabled: an empty jar should still let you
            reach the button and read why nothing happens. handleCashOut
            refuses on its own. */}
        <Button size="lg" fullWidth aria-disabled={empty} onPress={handleCashOut}>
          {empty
            ? 'Nothing in the jar'
            : state.mystery
              ? 'Cash out and reveal'
              : `Cash out ${money(total)}`}
        </Button>
        <p className="text-muted" style={{ fontSize: 12, textAlign: 'center', margin: '10px 0 0' }}>
          This empties the jar and starts a fresh one.
        </p>
      </div>
    </div>
  );
}
