'use client';

/**
 * Names — the first thing the demo asks for.
 *
 * Not in the handoff: the prototype hard-coded Alex and Sam and left renaming
 * to Settings. But the whole point of the jar is that it is the two of you, and
 * it reads as someone else's until the names are yours. Sits between Welcome
 * and Pairing, in the Pairing screen's left-aligned frame.
 *
 * Blank is allowed and falls back to "You" and "Them", which is what the
 * placeholders show, so nobody is trapped behind a form on the way in. Neither
 * field is isRequired for the same reason — the CTA never gates.
 *
 * On HeroUI: TextField wires the Label to the Input itself, so the htmlFor/id
 * pair is gone and the ids only stay because external selectors may want them.
 * `.field` rides along on the TextField so `.field > label` still styles the
 * label; gap 0 because HeroUI's .textfield adds its own 4px on top of the
 * label's 5px margin.
 */

import { Button, Input, Label, TextField } from '@heroui/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { NAME_FALLBACK_ME, NAME_FALLBACK_PARTNER } from '@/lib/constants';
import { useStore } from '@/lib/store';

export default function SetupPage() {
  const router = useRouter();
  const { dispatch } = useStore();

  const [me, setMe] = useState('');
  const [partner, setPartner] = useState('');

  const go = () => {
    dispatch({ type: 'setName', person: 'A', name: me.trim() || NAME_FALLBACK_ME });
    dispatch({ type: 'setName', person: 'S', name: partner.trim() || NAME_FALLBACK_PARTNER });
    router.push('/pair');
  };

  return (
    <div className="sj-screen sj-screen--onboarding" style={{ display: 'flex' }}>
      <h2 style={{ fontSize: 30, marginBottom: 8 }}>
        Who&rsquo;s in
        <br />
        this jar?
      </h2>
      <p className="text-muted" style={{ fontSize: 14, maxWidth: 280 }}>
        Both names show up on every fine. You can change them later.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 26 }}>
        {/* Two placements that are not interchangeable: `id` goes on the
            TextField, which is what the generated <label for> points at, and
            `autoFocus` goes on the Input, where the TextField swallows it. */}
        <TextField className="field" id="setup-me" style={{ gap: 0 }} value={me} onChange={setMe}>
          <Label>You</Label>
          <Input
            style={{ height: 44 }}
            placeholder={NAME_FALLBACK_ME}
            autoComplete="given-name"
            autoFocus
          />
        </TextField>
        <TextField
          className="field"
          id="setup-partner"
          style={{ gap: 0 }}
          value={partner}
          onChange={setPartner}
        >
          <Label>Them</Label>
          <Input
            style={{ height: 44 }}
            placeholder={NAME_FALLBACK_PARTNER}
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'Enter') go();
            }}
          />
        </TextField>
      </div>

      <div style={{ flex: 1 }} />

      <Button
        className="btn btn-primary btn-block"
        variant="primary"
        style={{ height: 54, fontSize: 17, marginTop: 0 }}
        onPress={go}
      >
        Next
      </Button>
    </div>
  );
}
