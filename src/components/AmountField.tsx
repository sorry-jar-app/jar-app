'use client';

/**
 * The borderless money row — a big Caprasimo "$" on a surface pill with a
 * transparent input beside it. Used by One-off (30px) and Rule detail (26px).
 */
export function AmountField({
  value,
  onChange,
  placeholder = '0.00',
  small = false,
  label,
}: {
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
        className="sj-amount__input"
        type="text"
        inputMode="decimal"
        aria-label={label ?? 'Amount'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
