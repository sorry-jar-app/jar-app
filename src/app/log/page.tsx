'use client';

/**
 * Log a fine — who, what, how bad, commit.
 *
 * The draft lives in the store rather than local state so "Something else"
 * can hand the same who/ruleId over to /log/one-off and back.
 */

import { useRouter } from 'next/navigation';
import { ChevronRightIcon } from '@/components/Icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { WhoPicker } from '@/components/WhoPicker';
import { SEVERITIES } from '@/lib/constants';
import { money, parseAmount } from '@/lib/money';
import { useStore } from '@/lib/store';

export default function LogFinePage() {
  const router = useRouter();
  const { state, dispatch } = useStore();
  const { who, ruleId, sev, customAmt } = state.draft;

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

  const submit = () => {
    dispatch({ type: 'fine/submit' });
    router.replace('/landed');
  };

  const goOneOff = () => {
    dispatch({ type: 'draft/patch', patch: { ruleId: 'custom' } });
    router.push('/log/one-off');
  };

  return (
    <div className="sj-screen sj-screen--pushed">
      <ScreenHeader title="Log a fine" backTo="/jar" />

      <div className="sj-body" style={{ padding: '4px 24px 18px', gap: 20 }}>
        <WhoPicker />

        <div className="sj-section">
          <h6 className="sj-label">What happened</h6>
          {state.rules.map((r) => (
            <button
              key={r.id}
              type="button"
              className="sj-pill sj-pill--rule sj-row"
              aria-pressed={ruleId === r.id}
              onClick={() => dispatch({ type: 'draft/patch', patch: { ruleId: r.id } })}
            >
              <span>{r.name}</span>
              <span className="sj-money" style={{ fontSize: 15 }}>
                {money(r.price)}
              </span>
            </button>
          ))}
          <button type="button" className="sj-pill sj-pill--rule sj-row" onClick={goOneOff}>
            <span>Something else</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, opacity: 0.7 }}>
              One-off
              <ChevronRightIcon size={15} />
            </span>
          </button>
        </div>

        <div className="sj-section">
          <h6 className="sj-label">How bad</h6>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {SEVERITIES.map((s) => (
              <button
                key={s.id}
                type="button"
                className="sj-pill sj-pill--sev"
                aria-pressed={sev === s.id}
                onClick={() => dispatch({ type: 'draft/patch', patch: { sev: s.id } })}
              >
                <span>{s.name}</span>
                <span style={{ fontSize: 11, opacity: 0.7 }}>×{s.mult}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>
          Fines are final once logged. Take it up with each other, not the app.
        </p>
      </div>

      <div className="sj-footer">
        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ height: 54, fontSize: 17, marginTop: 0 }}
          disabled={!ready}
          onClick={submit}
        >
          {ready ? `Add ${money(pending)} to the jar` : 'Pick who and what'}
        </button>
      </div>
    </div>
  );
}
