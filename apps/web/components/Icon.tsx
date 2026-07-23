import { forwardRef, type ForwardRefExoticComponent, type RefAttributes } from "react";
import { ArrowRight as PhosphorArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { BookOpen as PhosphorBookOpen } from "@phosphor-icons/react/dist/ssr/BookOpen";
import { CalendarBlank as PhosphorCalendarBlank } from "@phosphor-icons/react/dist/ssr/CalendarBlank";
import { Check as PhosphorCheck } from "@phosphor-icons/react/dist/ssr/Check";
import { CircleHalf as PhosphorCircleHalf } from "@phosphor-icons/react/dist/ssr/CircleHalf";
import { Crop as PhosphorCrop } from "@phosphor-icons/react/dist/ssr/Crop";
import { DownloadSimple as PhosphorDownloadSimple } from "@phosphor-icons/react/dist/ssr/DownloadSimple";
import { EnvelopeSimple as PhosphorEnvelopeSimple } from "@phosphor-icons/react/dist/ssr/EnvelopeSimple";
import { Eye as PhosphorEye } from "@phosphor-icons/react/dist/ssr/Eye";
import { Flag as PhosphorFlag } from "@phosphor-icons/react/dist/ssr/Flag";
import { FrameCorners as PhosphorFrameCorners } from "@phosphor-icons/react/dist/ssr/FrameCorners";
import { Image as PhosphorImage } from "@phosphor-icons/react/dist/ssr/Image";
import { LinkSimple as PhosphorLinkSimple } from "@phosphor-icons/react/dist/ssr/LinkSimple";
import { List as PhosphorList } from "@phosphor-icons/react/dist/ssr/List";
import { ListChecks as PhosphorListChecks } from "@phosphor-icons/react/dist/ssr/ListChecks";
import { Palette as PhosphorPalette } from "@phosphor-icons/react/dist/ssr/Palette";
import { PersonArmsSpread as PhosphorPersonArmsSpread } from "@phosphor-icons/react/dist/ssr/PersonArmsSpread";
import { SignIn as PhosphorSignIn } from "@phosphor-icons/react/dist/ssr/SignIn";
import { SignOut as PhosphorSignOut } from "@phosphor-icons/react/dist/ssr/SignOut";
import { Sparkle as PhosphorSparkle } from "@phosphor-icons/react/dist/ssr/Sparkle";
import { Trash as PhosphorTrash } from "@phosphor-icons/react/dist/ssr/Trash";
import type { Icon as PhosphorGlyph, IconProps as PhosphorIconProps } from "@phosphor-icons/react";

export const ICON_SIZES = [16, 20, 24, 32] as const;
export type IconSize = (typeof ICON_SIZES)[number];
export type IconWeight = "regular" | "fill" | "duotone";

export interface IconProps extends Omit<PhosphorIconProps, "alt" | "color" | "ref" | "size" | "weight"> {
  label?: string;
  decorative?: boolean;
  size?: IconSize;
  weight?: IconWeight;
}

interface IconBaseProps extends IconProps {
  glyph: PhosphorGlyph;
}

export const Icon = forwardRef<SVGSVGElement, IconBaseProps>(function Icon(
  { glyph: Glyph, size = 20, weight = "regular", label, decorative, className = "", "aria-label": ariaLabel, ...props },
  ref,
) {
  const accessibleLabel = label || ariaLabel;
  const isDecorative = decorative ?? !accessibleLabel;
  const resolvedWeight = weight === "duotone" && size !== 32 ? "regular" : weight;
  return <Glyph {...props} ref={ref} className={`ui-icon ${className}`.trim()} size={size} weight={resolvedWeight} color="currentColor" focusable="false" aria-hidden={isDecorative ? true : undefined} aria-label={isDecorative ? undefined : accessibleLabel} role={isDecorative ? undefined : "img"} />;
});

export type IconComponent = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

function createIcon(glyph: PhosphorGlyph, displayName: string): IconComponent {
  const WrappedIcon = forwardRef<SVGSVGElement, IconProps>((props, ref) => <Icon {...props} ref={ref} glyph={glyph} />);
  WrappedIcon.displayName = displayName;
  return WrappedIcon;
}

export const ArrowRight = createIcon(PhosphorArrowRight, "ArrowRight");
export const BookOpen = createIcon(PhosphorBookOpen, "BookOpen");
export const CalendarBlank = createIcon(PhosphorCalendarBlank, "CalendarBlank");
export const Check = createIcon(PhosphorCheck, "Check");
export const CircleHalf = createIcon(PhosphorCircleHalf, "CircleHalf");
export const Crop = createIcon(PhosphorCrop, "Crop");
export const DownloadSimple = createIcon(PhosphorDownloadSimple, "DownloadSimple");
export const EnvelopeSimple = createIcon(PhosphorEnvelopeSimple, "EnvelopeSimple");
export const Eye = createIcon(PhosphorEye, "Eye");
export const FileCheck = createIcon(PhosphorListChecks, "FileCheck");
export const Flag = createIcon(PhosphorFlag, "Flag");
export const FrameCorners = createIcon(PhosphorFrameCorners, "FrameCorners");
export const Image = createIcon(PhosphorImage, "Image");
export const LinkSimple = createIcon(PhosphorLinkSimple, "LinkSimple");
export const List = createIcon(PhosphorList, "List");
export const Palette = createIcon(PhosphorPalette, "Palette");
export const PersonArmsSpread = createIcon(PhosphorPersonArmsSpread, "PersonArmsSpread");
export const SignIn = createIcon(PhosphorSignIn, "SignIn");
export const SignOut = createIcon(PhosphorSignOut, "SignOut");
export const Sparkle = createIcon(PhosphorSparkle, "Sparkle");
export const Trash = createIcon(PhosphorTrash, "Trash");
