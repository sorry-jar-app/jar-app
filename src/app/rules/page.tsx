'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Chip, Input, TextField } from '@heroui/react';
import { ListView } from '@heroui-pro/react';
import { ChevronRightIcon, PlusIcon } from '@/components/Icons';
import { SEVERITIES } from '@/lib/constants';
import { money, parseAmount } from '@/lib/money';
import { useStore } from '@/lib/store';

/* .list-view--secondary paints its items transparent and rules a line under
   each one, both at a specificity .sj-surface-row cannot reach. Inline wins
   outright, and the hover tint has to come back the same way because the
   list's own :hover outranks .sj-row:hover too. */
function ruleRowStyle({ isHovered }: { isHovered: boolean }): React.CSSProperties {
  return {
    background: isHovered
      ? 'color-mix(in srgb, var(--color-text) 5%, transparent)'
      : 'var(--color-surface)',
    borderBottomColor: 'transparent',
  };
}

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
        {/* One tab stop for the whole list, arrow keys between rules, and
            typeahead on the names — a list that grows should not grow the
            tab order with it. */}
        <ListView
          aria-label="Rules"
          variant="secondary"
          // Deleting the last rule otherwise leaves a zero-height focusable
          // grid that announces as empty. Before the port an empty list
          // rendered nothing at all.
          renderEmptyState={() => (
            <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
              No rules yet. Add the first one.
            </p>
          )}
          items={state.rules}
          onAction={(key) => openRule(String(key))}
          // flexShrink:0 is load-bearing. .list-view ships an explicit
          // min-height:0, which cancels the flexbox automatic minimum size, so
          // it becomes the only child of .sj-body that can be squashed. Past
          // about eight rules the list absorbs the whole overflow: the last
          // rows paint on top of "Add a rule", and .sj-body never scrolls
          // because after the crush everything "fits".
          style={{ display: 'flex', flexDirection: 'column', gap: 9, flexShrink: 0 }}
        >
          {(rule) => (
            <ListView.Item
              id={rule.id}
              textValue={rule.name}
              className="sj-surface-row"
              style={ruleRowStyle}
            >
              <ListView.ItemContent>
                <span style={{ flex: 1, fontSize: 15 }}>{rule.name}</span>
                <span className="sj-money" style={{ fontSize: 16 }}>
                  {money(rule.price)}
                </span>
                {/* The list tints its own svg children --muted; the chevron
                    has always been the row's ink at 45%. */}
                <ChevronRightIcon size={16} style={{ opacity: 0.45, color: 'inherit' }} />
              </ListView.ItemContent>
            </ListView.Item>
          )}
        </ListView>

        {adding ? (
          <div
            className="sj-panel--accent"
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <div style={{ display: 'flex', gap: 9 }}>
              <TextField
                aria-label="Rule name"
                value={name}
                onChange={setName}
                style={{ flex: 1 }}
              >
                <Input placeholder="Rule name" />
              </TextField>
              <TextField
                aria-label="Base price"
                value={price}
                onChange={setPrice}
                style={{ width: 92 }}
              >
                <Input inputMode="decimal" placeholder="$0.00" />
              </TextField>
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <Button
                className="btn btn-secondary"
                variant="ghost"
                style={{ flex: 1, height: 42 }}
                onPress={closeForm}
              >
                Cancel
              </Button>
              <Button
                className="btn btn-primary"
                variant="ghost"
                style={{ flex: 1, height: 42, marginTop: 0 }}
                onPress={addRule}
              >
                Add rule
              </Button>
            </div>
          </div>
        ) : (
          <Button
            className="btn btn-secondary btn-block"
            variant="ghost"
            style={{ height: 48, gap: 8, marginTop: 4 }}
            onPress={() => setAdding(true)}
          >
            {/* .button sizes its own svg children at 20px, 16px above 640. */}
            <PlusIcon size={17} style={{ width: 17, height: 17, margin: 0 }} />
            Add a rule
          </Button>
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
              // .chip__label adds its own 2px inline padding on top of .tag's
              // 3px/10px; zeroing it keeps the tag the width it has always been.
              <Chip key={sev.id} className="tag tag-accent-2">
                <Chip.Label style={{ padding: 0 }}>
                  {sev.name} ×{sev.mult}
                </Chip.Label>
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
