import type { ReactNode, SVGProps } from "react";

// Minimal stroke icon set (Lucide-style geometry). Inline so there is no
// dependency; color follows currentColor.
function Icon({
  size = 16,
  children,
  ...rest
}: Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const LinkIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </Icon>
);

export const CheckIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);

export const TrashIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Icon>
);

export const EyeIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const CalendarIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </Icon>
);

export const FlagIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1Z" />
    <path d="M4 22v-7" />
  </Icon>
);

export const ImageIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </Icon>
);

export const ArrowRightIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </Icon>
);

export const MailIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </Icon>
);

// Brand logos (filled, follow currentColor) - accept className for sizing.
export const AppleIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M16.365 1.43c0 1.14-.417 2.2-1.11 2.98-.83.95-2.19 1.68-3.32 1.6-.14-1.11.42-2.28 1.06-3 .72-.82 2.02-1.44 3.13-1.5.01.14.24.32.24.32zM20.7 17.4c-.53 1.23-.78 1.77-1.46 2.85-.95 1.51-2.29 3.39-3.95 3.4-1.48.01-1.86-.96-3.86-.95-2 .01-2.42.96-3.9.95-1.66-.01-2.93-1.71-3.88-3.22C1.02 16.9.74 12.2 2.4 9.7c1.18-1.79 3.04-2.84 4.79-2.84 1.78 0 2.9.98 4.37.98 1.43 0 2.3-.98 4.37-.98 1.56 0 3.22.85 4.4 2.32-3.87 2.12-3.24 7.64.37 8.22z" />
  </svg>
);

export const WindowsIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M3 5.1 10.4 4v7.3H3V5.1zm0 13.8L10.4 20v-7.2H3v6.1zM11.3 3.9 21 2.5v8.8h-9.7V3.9zm0 8.2H21V21.5l-9.7-1.4v-8z" />
  </svg>
);
