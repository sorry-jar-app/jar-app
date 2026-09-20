'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Chip, Input, Label, TextField } from '@heroui/react';
import { AmountField } from '@/components/AmountField';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SEVERITIES } from '@/lib/constants';
import { money, parseAmount, veil } from '@/lib/money';
import { useStore } from '@/lib/store';

export default function EditRulePage() {
  const router = useRouter();
  const { state, dispatch, sealed } = useStore();

  const editingId = state.editingRuleId;
  const rule = editingId ? (state.rules.find((r) => r.id === editingId) ?? null) : null;

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  // Which rule the fields were filled from, so a later store change never
  // overwrites what is being typed.
  const [seededId, setSeededId] = useState<string | null>(null);
  // Save and Delete navigate themselves; the guard below must not race them.
  const leaving = useRef(false);

  useEffect(() => {
    if (!rule || seededId === rule.id) return;
    setName(rule.name);
    setPrice(rule.price.toFixed(2));
    setSeededId(rule.id);
  }, [rule, seededId]);

  // Reached directly, or the rule is gone: there is nothing to edit.
  useEffect(() => {
    if (!rule && !leaving.current) router.replace('/rules');
  }, [rule, router]);

  if (!rule) return null;

  const spent = state.fines.reduce((a, f) => (f.rule === rule.id ? a + f.amt : a), 0);
  const logged = state.fines.filter((f) => f.rule === rule.id).length;
  const base = parseAmount(price);

  function save() {
    if (!rule) return;
    const trimmed = name.trim();
    if (!trimmed || base <= 0) return;
    leaving.current = true;
    dispatch({ type: 'rule/edit', id: rule.id, name: trimmed, price: base });
    router.push('/rules');
  }

  function remove() {
    if (!rule) return;
    leaving.current = true;
    dispatch({ type: 'rule/delete', id: rule.id });
    router.push('/rules');
  }

  return (
    <div className="sj-screen sj-screen--pushed">
      <ScreenHeader title="Edit rule" backTo="/rules" />

      <div className="sj-body" style={{ padding: '4px 24px 18px', gap: 18 }}>
        {/* TextField wires the label to the input itself, so the id the
            htmlFor used is no longer anyone's to get wrong. .field is on the
            TextField root, not around it, because .field > label needs the
            label to be a direct child. */}
        <TextField className="field" value={name} onChange={setName}>
          <Label>Name</Label>
          <Input style={{ height: 44 }} />
        </TextField>

        {/* Not a NumberField. This field holds a raw string on its way through
            parseAmount, and the 30px Caprasimo $ is the field. */}
        <div className="field">
          <label htmlFor="rule-price">Base price</label>
          <AmountField id="rule-price" value={price} onChange={setPrice} placeholder="" small />
        </div>

        <div className="sj-panel sj-panel--sage" style={{ padding: '18px 20px' }}>
          <h6 style={{ margin: '0 0 8px' }}>So far</h6>
          {/* Seals. This is accumulated fines — the same quantity Stats masks —
              and reading it off three rules reconstructs the jar total. The
              severity previews below do not seal: they are derived from the
              base price being typed, so they give nothing away. */}
          <div className="sj-money" style={{ fontSize: 26, lineHeight: 1.1 }}>
            {veil(spent, sealed)}
          </div>
          <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
            {logged} fines logged
          </div>
        </div>

        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {SEVERITIES.map((sev) => (
            <Chip key={sev.id} className="tag tag-accent">
              <Chip.Label style={{ padding: 0 }}>
                {sev.name} {money(base * sev.mult)}
              </Chip.Label>
            </Chip>
          ))}
        </div>
      </div>

      <div className="sj-footer">
        <Button
          className="btn btn-primary btn-block"
          variant="ghost"
          style={{ height: 52, fontSize: 16, marginTop: 0 }}
          onPress={save}
        >
          Save changes
        </Button>
        <Button
          className="btn btn-ghost btn-block"
          variant="ghost"
          style={{ height: 44, color: 'var(--color-accent-700)' }}
          onPress={remove}
        >
          Delete this rule
        </Button>
      </div>
    </div>
  );
}
