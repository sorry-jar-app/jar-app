'use client';
import { useState } from 'react';
import {
  Avatar, Button, Card, Chip, Input, Label, ProgressBar, Separator, Switch, TextField,
} from '@heroui/react';

const PALETTES = ['Mulberry', 'Pine', 'Ink', 'Terracotta'] as const;

export default function Bridge() {
  const [p, setP] = useState<string>('Mulberry');
  return (
    <div style={{ padding: 16, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {PALETTES.map((n) => (
          <button key={n} id={`pal-${n}`} onClick={() => {
            document.documentElement.setAttribute('data-palette', n); setP(n);
          }}>{n}</button>
        ))}
      </div>
      <div id="now">{p}</div>
      <Card>
        <Card.Content>
          <div style={{ display: 'grid', gap: 12 }}>
            <Button id="btn-accent">Log a fine</Button>
            <Button id="btn-secondary" variant="secondary">Not now</Button>
            <TextField>
              <Label>Amount</Label>
              <Input id="tf" placeholder="0.00" />
            </TextField>
            <Switch>
              <Switch.Content>Mystery jar</Switch.Content>
              <Switch.Control><Switch.Thumb /></Switch.Control>
            </Switch>
            <Chip id="chip">Mild</Chip>
            <Avatar id="av"><Avatar.Fallback>N</Avatar.Fallback></Avatar>
            <Separator />
            <ProgressBar id="pb" value={62}>
              <ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
            </ProgressBar>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
