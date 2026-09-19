'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRightIcon, PlusIcon } from '@/components/Icons';
import { SEVERITIES } from '@/lib/constants';
import { money, parseAmount } from '@/lib/money';
import { useStore } from '@/lib/store';

export default function RulesPage() {
  const router = useRouter();
  const { state, dispatch } = useStore();

  // The add form is screen-local: nothing outside this page cares about a
  // half-typed rule, so it never reaches the store.
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');

  function closeForm() {
    setAdding(false);
    setName('');
    setPrice('');
  }

  function openRule(id: string) {
    dispatch({ type: 'rule/openEditor', id });
    router.push('/rules/edit');
  }

  function addRule() {
    const trimmed = name.trim();
    const amount = parseAmount(price);
    if (!trimmed || amount <= 0) return;
    dispatch({ type: 'rule/add', name: trimmed, price: amount });
    closeForm();
  }

  return (
    <div className="sj-screen sj-screen--tabbed">
      <div style={{ padding: '12px 24px 6px' }}>
        <h3 style={{ margin: 0 }}>Rules</h3>
        <p className="text-muted" style={{ fontSize: 13, margin: '4px 0 0' }}>
          Both of you have to agree to a change.
        </p>
      </div>

      <div className="sj-body" style={{ padding: '12px 24px 20px', gap: 9 }}>
        {state.rules.map((rule) => (
          <button
            key={rule.id}
            type="button"
            className="sj-surface-row sj-row"
            onClick={() => openRule(rule.id)}
          >
            <span style={{ flex: 1, fontSize: 15 }}>{rule.name}</span>
            <span className="sj-money" style={{ fontSize: 16 }}>
              {money(rule.price)}
            </span>
            <ChevronRightIcon size={16} style={{ opacity: 0.45 }} />
          </button>
        ))}

        {adding ? (
          <div
            className="sj-panel--accent"
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <div style={{ display: 'flex', gap: 9 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                aria-label="Rule name"
                placeholder="Rule name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="input"
                style={{ width: 92 }}
                aria-label="Base price"
                inputMode="decimal"
                placeholder="$0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, height: 42 }}
                onClick={closeForm}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, height: 42, marginTop: 0 }}
                onClick={addRule}
              >
                Add rule
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-secondary btn-block"
            style={{ height: 48, gap: 8, marginTop: 4 }}
            onClick={() => setAdding(true)}
          >
            <PlusIcon size={17} />
            Add a rule
          </button>
        )}

        <div
          className="sj-panel sj-panel--sage"
          style={{ marginTop: 12, padding: '18px 20px' }}
        >
          <h6 style={{ margin: '0 0 8px' }}>Severity</h6>
          <p style={{ fontSize: 13, margin: '0 0 10px', opacity: 0.85 }}>
            Every rule has a base price. When you log it, you pick how bad it was and the price
            multiplies.
          </p>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {SEVERITIES.map((sev) => (
              <span key={sev.id} className="tag tag-accent-2">
                {sev.name} ×{sev.mult}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
