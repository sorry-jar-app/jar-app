'use client';

/**
 * The borderless money row — a big Caprasimo "$" on a surface pill with a
 * transparent input beside it. Used by One-off (30px) and Rule detail (26px).
 */
export function AmountField({
  id,
  value,
  onChange,
  placeholder = '0.00',
  small = false,
  label,
}: {
  /** Pass this when a visible <label htmlFor> should own the field. */
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  small?: boolean;
  label?: string;
}) {
  return (
    <div className={small ? 'sj-amount sj-amount--sm' : 'sj-amount'}>
      <span className="sj-amount__symbol" aria-hidden="true">
        $
      </span>
      <input
        id={id}
        className="sj-amount__input"
        type="text"
        inputMode="decimal"
        // A visible label wins; aria-label is the fallback for fields without one.
        aria-label={id ? undefined : (label ?? 'Amount')}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
