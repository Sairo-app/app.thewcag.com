import { forwardRef, type ForwardRefExoticComponent, type RefAttributes } from "react";
import { Aperture as PhosphorAperture } from "@phosphor-icons/react/dist/csr/Aperture";
import { Archive as PhosphorArchive } from "@phosphor-icons/react/dist/csr/Archive";
import { ArrowClockwise as PhosphorArrowClockwise } from "@phosphor-icons/react/dist/csr/ArrowClockwise";
import { ArrowCounterClockwise as PhosphorArrowCounterClockwise } from "@phosphor-icons/react/dist/csr/ArrowCounterClockwise";
import { ArrowDownRight as PhosphorArrowDownRight } from "@phosphor-icons/react/dist/csr/ArrowDownRight";
import { ArrowLeft as PhosphorArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowRight as PhosphorArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowSquareOut as PhosphorArrowSquareOut } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { ArrowUUpLeft as PhosphorArrowUUpLeft } from "@phosphor-icons/react/dist/csr/ArrowUUpLeft";
import { ArrowUUpRight as PhosphorArrowUUpRight } from "@phosphor-icons/react/dist/csr/ArrowUUpRight";
import { ArrowsClockwise as PhosphorArrowsClockwise } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";
import { ArrowsLeftRight as PhosphorArrowsLeftRight } from "@phosphor-icons/react/dist/csr/ArrowsLeftRight";
import { ArrowsOutSimple as PhosphorArrowsOutSimple } from "@phosphor-icons/react/dist/csr/ArrowsOutSimple";
import { BookOpenText as PhosphorBookOpenText } from "@phosphor-icons/react/dist/csr/BookOpenText";
import { Camera as PhosphorCamera } from "@phosphor-icons/react/dist/csr/Camera";
import { CaretDown as PhosphorCaretDown } from "@phosphor-icons/react/dist/csr/CaretDown";
import { ChartBarHorizontal as PhosphorChartBarHorizontal } from "@phosphor-icons/react/dist/csr/ChartBarHorizontal";
import { Check as PhosphorCheck } from "@phosphor-icons/react/dist/csr/Check";
import { CheckCircle as PhosphorCheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { CheckSquare as PhosphorCheckSquare } from "@phosphor-icons/react/dist/csr/CheckSquare";
import { Clipboard as PhosphorClipboard } from "@phosphor-icons/react/dist/csr/Clipboard";
import { ClipboardText as PhosphorClipboardText } from "@phosphor-icons/react/dist/csr/ClipboardText";
import { ClockCounterClockwise as PhosphorClockCounterClockwise } from "@phosphor-icons/react/dist/csr/ClockCounterClockwise";
import { CloudArrowUp as PhosphorCloudArrowUp } from "@phosphor-icons/react/dist/csr/CloudArrowUp";
import { CloudCheck as PhosphorCloudCheck } from "@phosphor-icons/react/dist/csr/CloudCheck";
import { Code as PhosphorCode } from "@phosphor-icons/react/dist/csr/Code";
import { Command as PhosphorCommand } from "@phosphor-icons/react/dist/csr/Command";
import { Copy as PhosphorCopy } from "@phosphor-icons/react/dist/csr/Copy";
import { Crop as PhosphorCrop } from "@phosphor-icons/react/dist/csr/Crop";
import { Crosshair as PhosphorCrosshair } from "@phosphor-icons/react/dist/csr/Crosshair";
import { Cursor as PhosphorCursor } from "@phosphor-icons/react/dist/csr/Cursor";
import { Desktop as PhosphorDesktop } from "@phosphor-icons/react/dist/csr/Desktop";
import { DownloadSimple as PhosphorDownloadSimple } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { Eye as PhosphorEye } from "@phosphor-icons/react/dist/csr/Eye";
import { EyeSlash as PhosphorEyeSlash } from "@phosphor-icons/react/dist/csr/EyeSlash";
import { FileArrowDown as PhosphorFileArrowDown } from "@phosphor-icons/react/dist/csr/FileArrowDown";
import { FileText as PhosphorFileText } from "@phosphor-icons/react/dist/csr/FileText";
import { Fingerprint as PhosphorFingerprint } from "@phosphor-icons/react/dist/csr/Fingerprint";
import { FloppyDisk as PhosphorFloppyDisk } from "@phosphor-icons/react/dist/csr/FloppyDisk";
import { FrameCorners as PhosphorFrameCorners } from "@phosphor-icons/react/dist/csr/FrameCorners";
import { FunnelSimple as PhosphorFunnelSimple } from "@phosphor-icons/react/dist/csr/FunnelSimple";
import { GearSix as PhosphorGearSix } from "@phosphor-icons/react/dist/csr/GearSix";
import { HighlighterCircle as PhosphorHighlighterCircle } from "@phosphor-icons/react/dist/csr/HighlighterCircle";
import { Image as PhosphorImage } from "@phosphor-icons/react/dist/csr/Image";
import { ImageSquare as PhosphorImageSquare } from "@phosphor-icons/react/dist/csr/ImageSquare";
import { Info as PhosphorInfo } from "@phosphor-icons/react/dist/csr/Info";
import { Key as PhosphorKey } from "@phosphor-icons/react/dist/csr/Key";
import { Lightbulb as PhosphorLightbulb } from "@phosphor-icons/react/dist/csr/Lightbulb";
import { LinkSimple as PhosphorLinkSimple } from "@phosphor-icons/react/dist/csr/LinkSimple";
import { LockKey as PhosphorLockKey } from "@phosphor-icons/react/dist/csr/LockKey";
import { MagicWand as PhosphorMagicWand } from "@phosphor-icons/react/dist/csr/MagicWand";
import { MagnifyingGlass as PhosphorMagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { Minus as PhosphorMinus } from "@phosphor-icons/react/dist/csr/Minus";
import { Monitor as PhosphorMonitor } from "@phosphor-icons/react/dist/csr/Monitor";
import { MouseSimple as PhosphorMouseSimple } from "@phosphor-icons/react/dist/csr/MouseSimple";
import { Network as PhosphorNetwork } from "@phosphor-icons/react/dist/csr/Network";
import { NotePencil as PhosphorNotePencil } from "@phosphor-icons/react/dist/csr/NotePencil";
import { OpenAiLogo as PhosphorOpenAiLogo } from "@phosphor-icons/react/dist/csr/OpenAiLogo";
import { Palette as PhosphorPalette } from "@phosphor-icons/react/dist/csr/Palette";
import { PencilSimple as PhosphorPencilSimple } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { Plug as PhosphorPlug } from "@phosphor-icons/react/dist/csr/Plug";
import { Plus as PhosphorPlus } from "@phosphor-icons/react/dist/csr/Plus";
import { Ruler as PhosphorRuler } from "@phosphor-icons/react/dist/csr/Ruler";
import { Selection as PhosphorSelection } from "@phosphor-icons/react/dist/csr/Selection";
import { ShareNetwork as PhosphorShareNetwork } from "@phosphor-icons/react/dist/csr/ShareNetwork";
import { ShieldCheck as PhosphorShieldCheck } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { SidebarSimple as PhosphorSidebarSimple } from "@phosphor-icons/react/dist/csr/SidebarSimple";
import { SignIn as PhosphorSignIn } from "@phosphor-icons/react/dist/csr/SignIn";
import { SignOut as PhosphorSignOut } from "@phosphor-icons/react/dist/csr/SignOut";
import { SlidersHorizontal as PhosphorSlidersHorizontal } from "@phosphor-icons/react/dist/csr/SlidersHorizontal";
import { Sparkle as PhosphorSparkle } from "@phosphor-icons/react/dist/csr/Sparkle";
import { SquaresFour as PhosphorSquaresFour } from "@phosphor-icons/react/dist/csr/SquaresFour";
import { Target as PhosphorTarget } from "@phosphor-icons/react/dist/csr/Target";
import { TextT as PhosphorTextT } from "@phosphor-icons/react/dist/csr/TextT";
import { Ticket as PhosphorTicket } from "@phosphor-icons/react/dist/csr/Ticket";
import { Trash as PhosphorTrash } from "@phosphor-icons/react/dist/csr/Trash";
import { UploadSimple as PhosphorUploadSimple } from "@phosphor-icons/react/dist/csr/UploadSimple";
import { UserCircle as PhosphorUserCircle } from "@phosphor-icons/react/dist/csr/UserCircle";
import { Warning as PhosphorWarning } from "@phosphor-icons/react/dist/csr/Warning";
import { WarningCircle as PhosphorWarningCircle } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { X as PhosphorX } from "@phosphor-icons/react/dist/csr/X";
import type { Icon as PhosphorGlyph, IconProps as PhosphorIconProps } from "@phosphor-icons/react";

export const ICON_SIZES = [16, 20, 24, 32] as const;
export type IconSize = (typeof ICON_SIZES)[number];
export type IconWeight = "regular" | "fill" | "duotone";

export interface IconProps extends Omit<PhosphorIconProps, "alt" | "color" | "ref" | "size" | "weight"> {
  /** An accessible name for an icon that communicates meaning without adjacent text. */
  label?: string;
  /** Decorative icons are hidden from assistive technology. Defaults to true without a label. */
  decorative?: boolean;
  size?: IconSize;
  weight?: IconWeight;
}

interface IconBaseProps extends IconProps {
  glyph: PhosphorGlyph;
}

export const Icon = forwardRef<SVGSVGElement, IconBaseProps>(function Icon(
  {
    glyph: Glyph,
    size = 20,
    weight = "regular",
    label,
    decorative,
    className = "",
    "aria-label": ariaLabel,
    ...props
  },
  ref,
) {
  const accessibleLabel = label || ariaLabel;
  const isDecorative = decorative ?? !accessibleLabel;
  const resolvedWeight = weight === "duotone" && size !== 32 ? "regular" : weight;

  return (
    <Glyph
      {...props}
      ref={ref}
      className={`ui-icon ${className}`.trim()}
      size={size}
      weight={resolvedWeight}
      color="currentColor"
      focusable="false"
      aria-hidden={isDecorative ? true : undefined}
      aria-label={isDecorative ? undefined : accessibleLabel}
      role={isDecorative ? undefined : "img"}
    />
  );
});

export type IconComponent = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

function createIcon(glyph: PhosphorGlyph, displayName: string): IconComponent {
  const WrappedIcon = forwardRef<SVGSVGElement, IconProps>((props, ref) => (
    <Icon {...props} ref={ref} glyph={glyph} />
  ));
  WrappedIcon.displayName = displayName;
  return WrappedIcon;
}

export const Aperture = createIcon(PhosphorAperture, "Aperture");
export const Archive = createIcon(PhosphorArchive, "Archive");
export const ArrowClockwise = createIcon(PhosphorArrowClockwise, "ArrowClockwise");
export const ArrowCounterClockwise = createIcon(PhosphorArrowCounterClockwise, "ArrowCounterClockwise");
export const ArrowDownRight = createIcon(PhosphorArrowDownRight, "ArrowDownRight");
export const ArrowLeft = createIcon(PhosphorArrowLeft, "ArrowLeft");
export const ArrowRight = createIcon(PhosphorArrowRight, "ArrowRight");
export const ArrowsClockwise = createIcon(PhosphorArrowsClockwise, "ArrowsClockwise");
export const ArrowsLeftRight = createIcon(PhosphorArrowsLeftRight, "ArrowsLeftRight");
export const ArrowsOutSimple = createIcon(PhosphorArrowsOutSimple, "ArrowsOutSimple");
export const ArrowSquareOut = createIcon(PhosphorArrowSquareOut, "ArrowSquareOut");
export const ArrowUUpLeft = createIcon(PhosphorArrowUUpLeft, "ArrowUUpLeft");
export const ArrowUUpRight = createIcon(PhosphorArrowUUpRight, "ArrowUUpRight");
export const BookOpenText = createIcon(PhosphorBookOpenText, "BookOpenText");
export const Camera = createIcon(PhosphorCamera, "Camera");
export const CaretDown = createIcon(PhosphorCaretDown, "CaretDown");
export const ChartBarHorizontal = createIcon(PhosphorChartBarHorizontal, "ChartBarHorizontal");
export const Check = createIcon(PhosphorCheck, "Check");
export const CheckCircle = createIcon(PhosphorCheckCircle, "CheckCircle");
export const CheckSquare = createIcon(PhosphorCheckSquare, "CheckSquare");
export const Clipboard = createIcon(PhosphorClipboard, "Clipboard");
export const ClipboardText = createIcon(PhosphorClipboardText, "ClipboardText");
export const ClockCounterClockwise = createIcon(PhosphorClockCounterClockwise, "ClockCounterClockwise");
export const CloudArrowUp = createIcon(PhosphorCloudArrowUp, "CloudArrowUp");
export const CloudCheck = createIcon(PhosphorCloudCheck, "CloudCheck");
export const Code = createIcon(PhosphorCode, "Code");
export const Command = createIcon(PhosphorCommand, "Command");
export const Copy = createIcon(PhosphorCopy, "Copy");
export const Crop = createIcon(PhosphorCrop, "Crop");
export const Crosshair = createIcon(PhosphorCrosshair, "Crosshair");
export const Cursor = createIcon(PhosphorCursor, "Cursor");
export const Desktop = createIcon(PhosphorDesktop, "Desktop");
export const DownloadSimple = createIcon(PhosphorDownloadSimple, "DownloadSimple");
export const Eye = createIcon(PhosphorEye, "Eye");
export const EyeSlash = createIcon(PhosphorEyeSlash, "EyeSlash");
export const FileArrowDown = createIcon(PhosphorFileArrowDown, "FileArrowDown");
export const FileText = createIcon(PhosphorFileText, "FileText");
export const Fingerprint = createIcon(PhosphorFingerprint, "Fingerprint");
export const FloppyDisk = createIcon(PhosphorFloppyDisk, "FloppyDisk");
export const FrameCorners = createIcon(PhosphorFrameCorners, "FrameCorners");
export const FunnelSimple = createIcon(PhosphorFunnelSimple, "FunnelSimple");
export const GearSix = createIcon(PhosphorGearSix, "GearSix");
export const HighlighterCircle = createIcon(PhosphorHighlighterCircle, "HighlighterCircle");
export const Image = createIcon(PhosphorImage, "Image");
export const ImageSquare = createIcon(PhosphorImageSquare, "ImageSquare");
export const Info = createIcon(PhosphorInfo, "Info");
export const Key = createIcon(PhosphorKey, "Key");
export const Lightbulb = createIcon(PhosphorLightbulb, "Lightbulb");
export const LinkSimple = createIcon(PhosphorLinkSimple, "LinkSimple");
export const LockKey = createIcon(PhosphorLockKey, "LockKey");
export const MagicWand = createIcon(PhosphorMagicWand, "MagicWand");
export const MagnifyingGlass = createIcon(PhosphorMagnifyingGlass, "MagnifyingGlass");
export const Minus = createIcon(PhosphorMinus, "Minus");
export const Monitor = createIcon(PhosphorMonitor, "Monitor");
export const MouseSimple = createIcon(PhosphorMouseSimple, "MouseSimple");
export const Network = createIcon(PhosphorNetwork, "Network");
export const NotePencil = createIcon(PhosphorNotePencil, "NotePencil");
export const OpenAiLogo = createIcon(PhosphorOpenAiLogo, "OpenAiLogo");
export const Palette = createIcon(PhosphorPalette, "Palette");
export const PencilSimple = createIcon(PhosphorPencilSimple, "PencilSimple");
export const Plug = createIcon(PhosphorPlug, "Plug");
export const Plus = createIcon(PhosphorPlus, "Plus");
export const Ruler = createIcon(PhosphorRuler, "Ruler");
export const Selection = createIcon(PhosphorSelection, "Selection");
export const ShareNetwork = createIcon(PhosphorShareNetwork, "ShareNetwork");
export const ShieldCheck = createIcon(PhosphorShieldCheck, "ShieldCheck");
export const SidebarSimple = createIcon(PhosphorSidebarSimple, "SidebarSimple");
export const SignIn = createIcon(PhosphorSignIn, "SignIn");
export const SignOut = createIcon(PhosphorSignOut, "SignOut");
export const SlidersHorizontal = createIcon(PhosphorSlidersHorizontal, "SlidersHorizontal");
export const Sparkle = createIcon(PhosphorSparkle, "Sparkle");
export const SquaresFour = createIcon(PhosphorSquaresFour, "SquaresFour");
export const Target = createIcon(PhosphorTarget, "Target");
export const TextT = createIcon(PhosphorTextT, "TextT");
export const Ticket = createIcon(PhosphorTicket, "Ticket");
export const Trash = createIcon(PhosphorTrash, "Trash");
export const UploadSimple = createIcon(PhosphorUploadSimple, "UploadSimple");
export const UserCircle = createIcon(PhosphorUserCircle, "UserCircle");
export const Warning = createIcon(PhosphorWarning, "Warning");
export const WarningCircle = createIcon(PhosphorWarningCircle, "WarningCircle");
export const X = createIcon(PhosphorX, "X");
