import { forwardRef, type ForwardRefExoticComponent, type RefAttributes } from "react";
import { ArrowCounterClockwise as PhosphorArrowCounterClockwise } from "@phosphor-icons/react/dist/csr/ArrowCounterClockwise";
import { ArrowSquareOut as PhosphorArrowSquareOut } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { Check as PhosphorCheck } from "@phosphor-icons/react/dist/csr/Check";
import { CheckCircle as PhosphorCheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { Code as PhosphorCode } from "@phosphor-icons/react/dist/csr/Code";
import { Copy as PhosphorCopy } from "@phosphor-icons/react/dist/csr/Copy";
import { Crosshair as PhosphorCrosshair } from "@phosphor-icons/react/dist/csr/Crosshair";
import { Desktop as PhosphorDesktop } from "@phosphor-icons/react/dist/csr/Desktop";
import { DownloadSimple as PhosphorDownloadSimple } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { Eye as PhosphorEye } from "@phosphor-icons/react/dist/csr/Eye";
import { ImageSquare as PhosphorImageSquare } from "@phosphor-icons/react/dist/csr/ImageSquare";
import { MagicWand as PhosphorMagicWand } from "@phosphor-icons/react/dist/csr/MagicWand";
import { MouseSimple as PhosphorMouseSimple } from "@phosphor-icons/react/dist/csr/MouseSimple";
import { Plus as PhosphorPlus } from "@phosphor-icons/react/dist/csr/Plus";
import { Selection as PhosphorSelection } from "@phosphor-icons/react/dist/csr/Selection";
import { ShieldCheck as PhosphorShieldCheck } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { Sparkle as PhosphorSparkle } from "@phosphor-icons/react/dist/csr/Sparkle";
import { Trash as PhosphorTrash } from "@phosphor-icons/react/dist/csr/Trash";
import { Warning as PhosphorWarning } from "@phosphor-icons/react/dist/csr/Warning";
import { X as PhosphorX } from "@phosphor-icons/react/dist/csr/X";
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

export const ArrowCounterClockwise = createIcon(PhosphorArrowCounterClockwise, "ArrowCounterClockwise");
export const ArrowSquareOut = createIcon(PhosphorArrowSquareOut, "ArrowSquareOut");
export const Check = createIcon(PhosphorCheck, "Check");
export const CheckCircle = createIcon(PhosphorCheckCircle, "CheckCircle");
export const Code = createIcon(PhosphorCode, "Code");
export const Copy = createIcon(PhosphorCopy, "Copy");
export const Crosshair = createIcon(PhosphorCrosshair, "Crosshair");
export const Desktop = createIcon(PhosphorDesktop, "Desktop");
export const DownloadSimple = createIcon(PhosphorDownloadSimple, "DownloadSimple");
export const Eye = createIcon(PhosphorEye, "Eye");
export const ImageSquare = createIcon(PhosphorImageSquare, "ImageSquare");
export const MagicWand = createIcon(PhosphorMagicWand, "MagicWand");
export const MouseSimple = createIcon(PhosphorMouseSimple, "MouseSimple");
export const Plus = createIcon(PhosphorPlus, "Plus");
export const Selection = createIcon(PhosphorSelection, "Selection");
export const ShieldCheck = createIcon(PhosphorShieldCheck, "ShieldCheck");
export const Sparkle = createIcon(PhosphorSparkle, "Sparkle");
export const Trash = createIcon(PhosphorTrash, "Trash");
export const Warning = createIcon(PhosphorWarning, "Warning");
export const X = createIcon(PhosphorX, "X");
