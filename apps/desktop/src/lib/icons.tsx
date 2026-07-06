import type { ReactNode, SVGProps } from "react";

/**
 * Minimal stroke icon set (Lucide-style geometry, 24 viewBox, stroke 2).
 * Inline so the bundle stays dependency-free; color follows currentColor.
 */
function Icon({
  children,
  size = 14,
  ...rest
}: { children: ReactNode; size?: number } & SVGProps<SVGSVGElement>) {
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

export const CopyIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Icon>
);

export const CheckIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);

export const SwapIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M8 3 4 7l4 4" />
    <path d="M4 7h16" />
    <path d="m16 21 4-4-4-4" />
    <path d="M20 17H4" />
  </Icon>
);

export const UndoIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
  </Icon>
);

export const RedoIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M21 7v6h-6" />
    <path d="M3 17a9 9 0 0 1 15-6.7L21 13" />
  </Icon>
);

export const SaveIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7 10 5 5 5-5" />
    <path d="M12 15V3" />
  </Icon>
);

export const FreezeIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M12 2v20" />
    <path d="m4 7 16 10" />
    <path d="M20 7 4 17" />
  </Icon>
);

export const SplitIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M8 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3" />
    <path d="M16 5h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3" />
    <path d="M12 4v16" />
  </Icon>
);

export const CloseIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Icon>
);

export const CursorIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
  </Icon>
);

export const ArrowIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M7 17 17 7" />
    <path d="M7 7h10v10" />
  </Icon>
);

export const BoxIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
  </Icon>
);

export const RulerIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M21.3 8.7 15.3 2.7a1 1 0 0 0-1.4 0L2.7 13.9a1 1 0 0 0 0 1.4l6 6a1 1 0 0 0 1.4 0L21.3 10a1 1 0 0 0 0-1.4Z" />
    <path d="m7.5 10.5 2 2" />
    <path d="m10.5 7.5 2 2" />
    <path d="m13.5 4.5 2 2" />
  </Icon>
);

export const RedactIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18" />
    <path d="M3 15h18" />
    <path d="M9 3v18" />
    <path d="M15 3v18" />
  </Icon>
);

export const TypeIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M4 7V4h16v3" />
    <path d="M9 20h6" />
    <path d="M12 4v16" />
  </Icon>
);

export const IssueIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </Icon>
);

export const FolderIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  </Icon>
);

export const PipetteIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="m2 22 1-1h3l9-9" />
    <path d="M3 21v-3l9-9" />
    <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.9.9a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l-.1-.1Z" />
  </Icon>
);

export const PlusIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </Icon>
);

export const MinusIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M5 12h14" />
  </Icon>
);

export const FitIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </Icon>
);

export const ShareIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="m8.6 13.5 6.8 4" />
    <path d="m15.4 6.5-6.8 4" />
  </Icon>
);

export const TimerIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M10 2h4" />
    <path d="M12 14v-4" />
    <circle cx="12" cy="14" r="8" />
  </Icon>
);
