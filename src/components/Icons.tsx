/**
 * Lucide glyphs at stroke-width 2.75, the weight Organic asks for.
 *
 * Inlined rather than pulled from lucide-react: it is seven paths, and the
 * Capacitor bundle has no reason to carry a thousand more.
 */

type IconProps = {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
};

function svgProps(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.75,
    strokeLinecap: 'round' as const,
    'aria-hidden': true,
  };
}

export function BellIcon({ size = 17, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

export function GearIcon({ size = 17, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  );
}

export function ChevronLeftIcon({ size = 17, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 15, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function PlusIcon({ size = 19, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function EyeIcon({ size = 15, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** The jar outline — tab glyph and History's empty state. */
export function JarIcon({ size = 21, stroke, ...rest }: IconProps & { stroke?: string }) {
  return (
    <svg {...svgProps(size)} {...rest} stroke={stroke ?? 'currentColor'}>
      <path d="M8 2h8M6 8a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z" />
    </svg>
  );
}

export function ListIcon({ size = 21, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
}

export function BarsIcon({ size = 21, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M5 20V10M12 20V4M19 20v-7" />
    </svg>
  );
}

export function RulesIcon({ size = 21, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
