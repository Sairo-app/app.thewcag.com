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

export const MenuIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const MailIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </Icon>
);

export const CropIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M6 2v14a2 2 0 0 0 2 2h14" />
    <path d="M18 22V8a2 2 0 0 0-2-2H2" />
  </Icon>
);

export const SparklesIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="m12 3-1.15 3.1a3 3 0 0 1-1.75 1.75L6 9l3.1 1.15a3 3 0 0 1 1.75 1.75L12 15l1.15-3.1a3 3 0 0 1 1.75-1.75L18 9l-3.1-1.15a3 3 0 0 1-1.75-1.75L12 3Z" />
    <path d="m5 15-.65 1.75a2 2 0 0 1-1.1 1.1L1.5 18.5l1.75.65a2 2 0 0 1 1.1 1.1L5 22l.65-1.75a2 2 0 0 1 1.1-1.1l1.75-.65-1.75-.65a2 2 0 0 1-1.1-1.1L5 15Z" />
    <path d="m19 14-.55 1.45a2 2 0 0 1-.9.9L16 17l1.55.65a2 2 0 0 1 .9.9L19 20l.55-1.45a2 2 0 0 1 .9-.9L22 17l-1.55-.65a2 2 0 0 1-.9-.9L19 14Z" />
  </Icon>
);

export const FileCheckIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
    <path d="m9 15 2 2 4-4" />
  </Icon>
);

export const BookIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </Icon>
);

export const DownloadIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7 10 5 5 5-5" />
    <path d="M12 15V3" />
  </Icon>
);

export const LogInIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <path d="m10 17 5-5-5-5" />
    <path d="M15 12H3" />
  </Icon>
);

export const LogOutIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </Icon>
);

export const PaletteIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <circle cx="13.5" cy="6.5" r=".7" fill="currentColor" stroke="none" />
    <circle cx="17.5" cy="10.5" r=".7" fill="currentColor" stroke="none" />
    <circle cx="8.5" cy="7.5" r=".7" fill="currentColor" stroke="none" />
    <circle cx="6.5" cy="12.5" r=".7" fill="currentColor" stroke="none" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.6-.4-1.1 0-.9.7-1.6 1.6-1.6H16c3 0 5.5-2.5 5.5-5.6C22 6 17.5 2 12 2z" />
  </Icon>
);

export const AccessibilityIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <circle cx="16" cy="4" r="1" fill="currentColor" stroke="none" />
    <path d="m18 19 1-7-5.87.94" />
    <path d="m5 8 3-3 5.5 3-2.36 3.5" />
    <path d="M4.24 14.5a5 5 0 0 0 6.88 6" />
    <path d="M13.76 17.5a5 5 0 0 0-6.88-6" />
  </Icon>
);

/** Half-filled circle for contrast (needs a fill, so it's standalone). */
export const ContrastIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
    <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" />
  </svg>
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

export const GitHubIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.72-1.55-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56A10.52 10.52 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
  </svg>
);
