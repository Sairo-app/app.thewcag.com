export {
  ArrowRight as ArrowRightIcon,
  BookOpen as BookIcon,
  CalendarBlank as CalendarIcon,
  Check as CheckIcon,
  CircleHalf as ContrastIcon,
  Crop as CropIcon,
  DownloadSimple as DownloadIcon,
  EnvelopeSimple as MailIcon,
  Eye as EyeIcon,
  FileCheck as FileCheckIcon,
  Flag as FlagIcon,
  Image as ImageIcon,
  LinkSimple as LinkIcon,
  List as MenuIcon,
  Palette as PaletteIcon,
  PersonArmsSpread as AccessibilityIcon,
  SignIn as LogInIcon,
  SignOut as LogOutIcon,
  Sparkle as SparklesIcon,
  Trash as TrashIcon,
} from "./Icon";

// Genuine platform and company marks remain custom and inherit currentColor.
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
