'use client';

/**
 * One-off fine — a fine that is not a rule, at an exact price.
 *
 * No severity section: the amount is already the amount. Severity is recorded
 * as 'one-off' by the reducer.
 */

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AmountField } from '@/components/AmountField';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Toggle } from '@/components/Toggle';
import { WhoPicker } from '@/components/WhoPicker';
import { money, parseAmount } from '@/lib/money';
import { useStore } from '@/lib/store';

const QUICK_AMOUNTS = [1, 2, 5, 10];

export default function OneOffFinePage() {
  const router = useRouter();
  const { state, dispatch } = useStore();
  const { who, ruleId, customName, customAmt, saveAsRule } = state.draft;

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

  const submit = () => {
    submitted.current = true;
    dispatch({ type: 'fine/submit' });
    router.replace('/landed');
  };

  return (
    <div className="sj-screen sj-screen--pushed">
      <ScreenHeader title="One-off fine" backTo="/log" />

      <div className="sj-body" style={{ padding: '4px 24px 18px', gap: 20 }}>
        <WhoPicker />

        <div className="sj-section">
          <h6 className="sj-label">What happened</h6>
          <input
            className="input"
            style={{ height: 48, fontSize: 15 }}
            type="text"
            aria-label="What happened"
            placeholder="Ate my leftovers"
            value={customName}
            onChange={(e) => dispatch({ type: 'draft/patch', patch: { customName: e.target.value } })}
          />
        </div>

        <div className="sj-section">
          <h6 className="sj-label">How much</h6>
          <AmountField
            value={customAmt}
            onChange={(value) => dispatch({ type: 'draft/patch', patch: { customAmt: value } })}
            label="Amount"
          />
          <div style={{ display: 'flex', gap: 8 }}>
            {QUICK_AMOUNTS.map((v) => (
              <button
                key={v}
                type="button"
                className="sj-pill sj-pill--quick"
                aria-pressed={amt === v}
                onClick={() => dispatch({ type: 'draft/patch', patch: { customAmt: String(v) } })}
              >
                ${v}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="sj-toggle-row"
          aria-pressed={saveAsRule}
          onClick={() => dispatch({ type: 'draft/patch', patch: { saveAsRule: !saveAsRule } })}
        >
          <span style={{ flex: 1 }}>
            <span style={{ fontSize: 15, display: 'block' }}>Save as a rule</span>
            <span className="text-muted" style={{ fontSize: 12 }}>
              Keep it in the list for next time
            </span>
          </span>
          <Toggle on={saveAsRule} />
        </button>
      </div>

      <div className="sj-footer">
        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ height: 54, fontSize: 17, marginTop: 0 }}
          disabled={!ready}
          onClick={submit}
        >
          {ready ? `Add ${money(amt)} to the jar` : 'Add an amount'}
        </button>
      </div>
    </div>
  );
}
