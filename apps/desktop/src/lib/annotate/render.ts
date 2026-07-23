import { SEVERITY_COLORS, TARGET_MIN, type Shape } from "./model";
import { handlesFor } from "./geometry";
import { requireCanvas2d } from "./canvas";

export interface RenderOpts {
  selectedId?: number | null;
  hoverId?: number | null;
  /** ghost preview while a tool is armed (e.g. next badge under cursor) */
  ghost?: { kind: "badge"; x: number; y: number; num: number } | null;
  forExport?: boolean;
}

const STROKE = 4;

export function isLight(hex: string): boolean {
  const n = parseInt(hex.replace("#", ""), 16);
  return 0.299 * ((n >> 16) & 0xff) + 0.587 * ((n >> 8) & 0xff) + 0.114 * (n & 0xff) > 150;
}

export function badgeColor(s: Shape): string {
  return SEVERITY_COLORS[s.severity ?? "major"];
}

/** Draw the full document (image + shapes) in DOCUMENT pixel space. The
 *  caller owns the canvas transform (viewport zoom/pan or identity export). */
export function renderDoc(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | HTMLCanvasElement,
  shapes: Shape[],
  opts: RenderOpts = {},
) {
  ctx.drawImage(image, 0, 0);
  let badgeNum = 0;
  for (const s of shapes) {
    if (s.kind === "badge") badgeNum += 1;
    drawShape(ctx, image, s, badgeNum, opts);
  }
  drawFocusPath(ctx, shapes);
  if (opts.ghost && !opts.forExport) {
    ctx.globalAlpha = 0.55;
    drawBadge(ctx, opts.ghost.x, opts.ghost.y, opts.ghost.num, SEVERITY_COLORS.major);
    ctx.globalAlpha = 1;
  }
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | HTMLCanvasElement,
  s: Shape,
  badgeNum: number,
  opts: RenderOpts,
) {
  const x = Math.min(s.x1, s.x2);
  const y = Math.min(s.y1, s.y2);
  const w = Math.abs(s.x2 - s.x1);
  const h = Math.abs(s.y2 - s.y1);
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = STROKE;

  switch (s.kind) {
    case "rect":
      ctx.strokeRect(x, y, w, h);
      break;
    case "measure": {
      ctx.setLineDash([8, 5]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#2563EB";
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      const fails = w < TARGET_MIN && h < TARGET_MIN;
      pill(ctx, x, y > 26 ? y - 24 : y + h + 4, `${Math.round(w)} × ${Math.round(h)} px${fails ? "  ✕ 2.5.8" : ""}`, fails ? "#DC2626" : "rgba(15,23,42,0.85)");
      break;
    }
    case "redact": {
      if (s.style === "pixel") {
        const block = 14;
        const tiny = document.createElement("canvas");
        tiny.width = Math.max(1, Math.round(w / block));
        tiny.height = Math.max(1, Math.round(h / block));
        requireCanvas2d(tiny).drawImage(image, x, y, w, h, 0, 0, tiny.width, tiny.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tiny, 0, 0, tiny.width, tiny.height, x, y, w, h);
        ctx.imageSmoothingEnabled = true;
      } else {
        // solid is the default: pixelation can be reversed on text
        ctx.fillStyle = "#0F172A";
        ctx.fillRect(x, y, w, h);
      }
      break;
    }
    case "arrow": {
      const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      const head = 18;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s.x2, s.y2);
      ctx.lineTo(s.x2 - head * Math.cos(angle - Math.PI / 6), s.y2 - head * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(s.x2 - head * Math.cos(angle + Math.PI / 6), s.y2 - head * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "text": {
      ctx.font = "600 26px -apple-system, system-ui, sans-serif";
      ctx.lineWidth = 5;
      ctx.strokeStyle = s.color === "#FFFFFF" ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.85)";
      ctx.strokeText(s.text ?? "", s.x1, s.y1);
      ctx.fillText(s.text ?? "", s.x1, s.y1);
      break;
    }
    case "probe": {
      // two sample points joined by a line, ratio pill at the midpoint
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const p of [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }]) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7.5, 0, Math.PI * 2);
        ctx.strokeStyle = "#0F172A";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      const failing = s.text?.includes("✕");
      pill(ctx, (s.x1 + s.x2) / 2 - 40, (s.y1 + s.y2) / 2 - 30, s.text ?? "", failing ? "#DC2626" : "rgba(15,23,42,0.85)");
      break;
    }
    case "badge":
      drawBadge(ctx, s.x1, s.y1, badgeNum, badgeColor(s));
      break;
  }

  const pointLike = s.kind === "badge" || s.kind === "focus";
  if (!opts.forExport && s.id === opts.hoverId && s.id !== opts.selectedId) {
    ctx.strokeStyle = "rgba(37,99,235,0.5)";
    ctx.lineWidth = 3;
    if (pointLike) {
      ctx.beginPath();
      ctx.arc(s.x1, s.y1, 26, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeRect(x - 8, y - 8, w + 16, h + 16);
    }
  }

  if (!opts.forExport && s.id === opts.selectedId) {
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#2563EB";
    if (pointLike) ctx.strokeRect(s.x1 - 24, s.y1 - 24, 48, 48);
    else ctx.strokeRect(x - 6, y - 6, w + 12, h + 12);
    ctx.setLineDash([]);
    for (const hd of handlesFor(s)) {
      ctx.fillStyle = "#FFFFFF";
      ctx.strokeStyle = "#2563EB";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hd.x, hd.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}

/** Tab/focus-order visualization: a numbered connected path (WCAG 2.4.3). */
function drawFocusPath(ctx: CanvasRenderingContext2D, shapes: Shape[]) {
  const pts = shapes.filter((s) => s.kind === "focus");
  if (pts.length === 0) return;

  ctx.strokeStyle = "#2563EB";
  ctx.lineWidth = 3;
  ctx.setLineDash([2, 7]);
  ctx.lineCap = "round";
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x1, p.y1) : ctx.lineTo(p.x1, p.y1)));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineCap = "butt";

  for (let i = 1; i < pts.length; i++) {
    const from = pts[i - 1];
    const to = pts[i];
    const angle = Math.atan2(to.y1 - from.y1, to.x1 - from.x1);
    const tx = to.x1 - Math.cos(angle) * 16;
    const ty = to.y1 - Math.sin(angle) * 16;
    const head = 12;
    ctx.fillStyle = "#2563EB";
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - head * Math.cos(angle - Math.PI / 6), ty - head * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(tx - head * Math.cos(angle + Math.PI / 6), ty - head * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  pts.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(p.x1, p.y1, 15, 0, Math.PI * 2);
    ctx.fillStyle = "#2563EB";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#FFFFFF";
    ctx.stroke();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "700 16px -apple-system, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), p.x1, p.y1 + 1);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  });
}

function drawBadge(ctx: CanvasRenderingContext2D, x: number, y: number, num: number, color: string) {
  const onDark = !isLight(color);
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = onDark ? "#FFFFFF" : "#0F172A";
  ctx.stroke();
  ctx.fillStyle = onDark ? "#FFFFFF" : "#0F172A";
  ctx.font = "700 22px -apple-system, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(num), x, y + 1);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, bg: string) {
  ctx.font = "600 15px -apple-system, system-ui, sans-serif";
  const w = ctx.measureText(label).width + 12;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y, w, 20, 5);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(label, x + 6, y + 15);
}
