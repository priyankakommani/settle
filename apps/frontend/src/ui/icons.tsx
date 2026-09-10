import type { SVGProps } from 'react';

/**
 * Small hand-picked icon set as inline SVG (no icon dependency).
 * 1.6px stroke, 20px grid, inherits `currentColor`.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 18, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  Analytics: (p: IconProps) => (
    <Base {...p}>
      <path d="M4 19V10M10 19V5M16 19v-7M22 19H2" />
      <path d="m4 8 6-4 6 5 4-3" />
    </Base>
  ),
  Admin: (p: IconProps) => (
    <Base {...p}>
      <path d="M12 3 4.5 6.5v5c0 4.7 3.2 7.7 7.5 9.5 4.3-1.8 7.5-4.8 7.5-9.5v-5L12 3Z" />
      <path d="M9 12h6M12 9v6" />
    </Base>
  ),
  Trips: (p: IconProps) => (
    <Base {...p}>
      <path d="M4 6h16M4 12h16M4 18h10" />
    </Base>
  ),
  Inbox: (p: IconProps) => (
    <Base {...p}>
      <path d="M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
      <path d="M4 13 6 5a2 2 0 0 1 2-1.5h8A2 2 0 0 1 18 5l2 8" />
      <path d="M4 13h4l1.5 2.5h5L16 13h4" />
    </Base>
  ),
  Approvals: (p: IconProps) => (
    <Base {...p}>
      <path d="m9 12 2 2 4-4" />
      <circle cx="12" cy="12" r="9" />
    </Base>
  ),
  Wallet: (p: IconProps) => (
    <Base {...p}>
      <path d="M3 7a2 2 0 0 1 2-2h12v4" />
      <path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-1Z" />
      <circle cx="16" cy="13" r="1.4" />
    </Base>
  ),
  Clock: (p: IconProps) => (
    <Base {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Base>
  ),
  Plus: (p: IconProps) => (
    <Base {...p}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  ),
  ChevronRight: (p: IconProps) => (
    <Base {...p}>
      <path d="m9 6 6 6-6 6" />
    </Base>
  ),
  ChevronDown: (p: IconProps) => (
    <Base {...p}>
      <path d="m6 9 6 6 6-6" />
    </Base>
  ),
  File: (p: IconProps) => (
    <Base {...p}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </Base>
  ),
  Menu: (p: IconProps) => (
    <Base {...p}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Base>
  ),
  Close: (p: IconProps) => (
    <Base {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Base>
  ),
  Logout: (p: IconProps) => (
    <Base {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </Base>
  ),
  Sun: (p: IconProps) => (
    <Base {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
    </Base>
  ),
  Moon: (p: IconProps) => (
    <Base {...p}>
      <path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z" />
    </Base>
  ),
  Alert: (p: IconProps) => (
    <Base {...p}>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </Base>
  ),
  Bell: (p: IconProps) => (
    <Base {...p}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </Base>
  ),
  Check: (p: IconProps) => (
    <Base {...p}>
      <path d="m20 6-11 11-5-5" />
    </Base>
  ),
  Eye: (p: IconProps) => (
    <Base {...p}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </Base>
  ),
  EyeOff: (p: IconProps) => (
    <Base {...p}>
      <path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c6.5 0 10 6 10 6a17.6 17.6 0 0 1-3 3.6M6.6 6.6A17.6 17.6 0 0 0 2 12s3.5 6 10 6a9.6 9.6 0 0 0 4.4-1M3 3l18 18" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </Base>
  ),
  Briefcase: (p: IconProps) => (
    <Base {...p}>
      <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      <rect width="20" height="14" x="2" y="6" rx="2" />
    </Base>
  ),
  TrendingUp: (p: IconProps) => (
    <Base {...p}>
      <path d="M22 7 13.5 15.5 8.5 10.5 2 17" />
      <path d="M16 7h6v6" />
    </Base>
  ),
  CheckCircle: (p: IconProps) => (
    <Base {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </Base>
  ),
  ShieldCheck: (p: IconProps) => (
    <Base {...p}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.8 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </Base>
  ),
  Ban: (p: IconProps) => (
    <Base {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="m4.9 4.9 14.2 14.2" />
    </Base>
  ),
  Banknote: (p: IconProps) => (
    <Base {...p}>
      <rect width="20" height="12" x="2" y="6" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01M18 12h.01" />
    </Base>
  ),
  Zap: (p: IconProps) => (
    <Base {...p}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </Base>
  ),
  Refresh: (p: IconProps) => (
    <Base {...p}>
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </Base>
  ),
  Percent: (p: IconProps) => (
    <Base {...p}>
      <line x1="19" x2="5" y1="5" y2="19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </Base>
  ),
  Receipt: (p: IconProps) => (
    <Base {...p}>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M16 8H8M16 12H8M10 16H8" />
    </Base>
  ),
  Hotel: (p: IconProps) => (
    <Base {...p}>
      <path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9M12 8v9" />
    </Base>
  ),
  Car: (p: IconProps) => (
    <Base {...p}>
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H7c-.8 0-1.5.4-1.9 1L3 11s-1 .6-1 2v3c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </Base>
  ),
  Utensils: (p: IconProps) => (
    <Base {...p}>
      <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8Z" />
      <path d="M6 1v3M10 1v3M14 1v3" />
    </Base>
  ),
  Ticket: (p: IconProps) => (
    <Base {...p}>
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2Z" />
      <path d="M13 5v14" />
    </Base>
  ),
  Layers: (p: IconProps) => (
    <Base {...p}>
      <path d="m12 2 9 4.9-9 4.9-9-4.9L12 2Z" />
      <path d="m3 11.8 9 4.9 9-4.9" />
      <path d="m3 16.7 9 4.9 9-4.9" />
    </Base>
  ),
};

