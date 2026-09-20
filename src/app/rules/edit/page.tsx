'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Chip, Input, Label, TextField } from '@heroui/react';
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
            htmlFor used is no longer anyone's to get wrong. */}
        <TextField value={name} onChange={setName}>
          <Label>Name</Label>
          <Input />
        </TextField>

        {/* Not a NumberField. This field holds a raw string on its way through
            parseAmount, and the 30px Caprasimo $ is the field. The stack is
            hand-rolled because AmountField is not a HeroUI Input, but the
            label is the kit's so it matches the one above. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label htmlFor="rule-price">Base price</Label>
          <AmountField id="rule-price" value={price} onChange={setPrice} placeholder="" small />
        </div>

        <Card>
          <Card.Content style={{ gap: 2 }}>
            <h6 style={{ margin: '0 0 6px' }}>So far</h6>
            {/* Seals. This is accumulated fines — the same quantity Stats masks —
                and reading it off three rules reconstructs the jar total. The
                severity previews below do not seal: they are derived from the
                base price being typed, so they give nothing away. */}
            <div className="sj-money" style={{ fontSize: 26, lineHeight: 1.1 }}>
              {veil(spent, sealed)}
            </div>
            <div className="text-xs text-muted">{logged} fines logged</div>
          </Card.Content>
        </Card>

        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {SEVERITIES.map((sev) => (
            <Chip key={sev.id}>
              <Chip.Label>
                {sev.name} {money(base * sev.mult)}
              </Chip.Label>
            </Chip>
          ))}
        </div>
      </div>

      <div className="sj-footer" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Button size="lg" fullWidth onPress={save}>
          Save changes
        </Button>
        <Button variant="danger-soft" fullWidth onPress={remove}>
          Delete this rule
        </Button>
      </div>
    </div>
  );
}
