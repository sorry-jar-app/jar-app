'use client';

import { InputGroup, TextField } from '@heroui/react';

/**
 * The money row: a "$" on the kit's input group, with the figure beside it.
 *
 * Not a NumberField. The store holds the raw string the user typed and
 * parseAmount reads it at the last moment; a NumberField holds a number and
 * would normalise "2." on the keystroke after the dot. InputGroup.Input is a
 * plain text input, which is what that needs.
 */
export function AmountField({
  id,
  value,
  onChange,
  placeholder = '0.00',
  label,
}: {
  /** Pass this when a visible <label htmlFor> should own the field. */
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /**
   * Accepted for the callers that still pass it. The kit ships one field size
   * and the two call sites no longer differ.
   */
  small?: boolean;
  label?: string;
}) {
  return (
    <TextField
      fullWidth
      value={value}
      onChange={onChange}
      // A visible label wins; aria-label is the fallback for fields without one.
      aria-label={id ? undefined : (label ?? 'Amount')}
    >
      <InputGroup fullWidth>
        <InputGroup.Prefix aria-hidden="true">$</InputGroup.Prefix>
        <InputGroup.Input
          id={id}
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
        />
      </InputGroup>
    </TextField>
  );
}
