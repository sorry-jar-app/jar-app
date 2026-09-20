'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Chip, Input, TextField } from '@heroui/react';
import { ListView } from '@heroui-pro/react';
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
          style={{ flexShrink: 0 }}
        >
          {(rule) => (
            <ListView.Item id={rule.id} textValue={rule.name}>
              <ListView.ItemContent>
                <ListView.Title>{rule.name}</ListView.Title>
              </ListView.ItemContent>
              <ListView.ItemAction className="flex items-center gap-2">
                <span className="sj-money" style={{ fontSize: 16 }}>
                  {money(rule.price)}
                </span>
                <ChevronRightIcon size={16} className="text-muted" />
              </ListView.ItemAction>
            </ListView.Item>
          )}
        </ListView>

        {adding ? (
          <Card>
            <Card.Content style={{ gap: 10 }}>
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
                <Button variant="secondary" style={{ flex: 1 }} onPress={closeForm}>
                  Cancel
                </Button>
                <Button style={{ flex: 1 }} onPress={addRule}>
                  Add rule
                </Button>
              </div>
            </Card.Content>
          </Card>
        ) : (
          <Button variant="secondary" fullWidth onPress={() => setAdding(true)}>
            <PlusIcon />
            Add a rule
          </Button>
        )}

        <Card style={{ marginTop: 12 }}>
          <Card.Content style={{ gap: 8 }}>
            <h6 style={{ margin: 0 }}>Severity</h6>
            <p className="text-sm text-muted" style={{ margin: 0 }}>
              Every rule has a base price. When you log it, you pick how bad it was and the price
              multiplies.
            </p>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {SEVERITIES.map((sev) => (
                <Chip key={sev.id}>
                  <Chip.Label>
                    {sev.name} ×{sev.mult}
                  </Chip.Label>
                </Chip>
              ))}
            </div>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}
