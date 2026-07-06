import type { Shape } from "./model";

export interface Point {
  x: number;
  y: number;
}

export function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Topmost shape under the point. Arrows/probes use segment distance, not bbox. */
export function hitTest(shapes: Shape[], p: Point, tolerance: number): Shape | null {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    if (s.kind === "badge" || s.kind === "focus") {
      if (Math.hypot(p.x - s.x1, p.y - s.y1) <= tolerance + 18) return s;
      continue;
    }
    if (s.kind === "arrow" || s.kind === "probe") {
      if (distToSegment(p, { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }) <= tolerance) return s;
      continue;
    }
    if (s.kind === "text") {
      // approximate glyph box: 26px font, ~14px/char
      const w = (s.text?.length ?? 1) * 15;
      if (p.x >= s.x1 - tolerance && p.x <= s.x1 + w + tolerance && p.y >= s.y1 - 28 - tolerance && p.y <= s.y1 + tolerance) {
        return s;
      }
      continue;
    }
    const bx = Math.min(s.x1, s.x2) - tolerance;
    const by = Math.min(s.y1, s.y2) - tolerance;
    const bw = Math.abs(s.x2 - s.x1) + tolerance * 2;
    const bh = Math.abs(s.y2 - s.y1) + tolerance * 2;
    if (p.x >= bx && p.x <= bx + bw && p.y >= by && p.y <= by + bh) return s;
  }
  return null;
}

export function handlesFor(s: Shape): { key: string; x: number; y: number }[] {
  if (s.kind === "badge" || s.kind === "text" || s.kind === "focus") return [];
  if (s.kind === "arrow" || s.kind === "probe") {
    return [
      { key: "start", x: s.x1, y: s.y1 },
      { key: "end", x: s.x2, y: s.y2 },
    ];
  }
  return [
    { key: "p11", x: s.x1, y: s.y1 },
    { key: "p22", x: s.x2, y: s.y2 },
    { key: "p12", x: s.x1, y: s.y2 },
    { key: "p21", x: s.x2, y: s.y1 },
  ];
}

export function applyHandle(s: Shape, handle: string, p: Point): Shape {
  const next = { ...s };
  if (handle === "start" || handle === "p11") {
    next.x1 = p.x;
    next.y1 = p.y;
  } else if (handle === "end" || handle === "p22") {
    next.x2 = p.x;
    next.y2 = p.y;
  } else if (handle === "p12") {
    next.x1 = p.x;
    next.y2 = p.y;
  } else if (handle === "p21") {
    next.x2 = p.x;
    next.y1 = p.y;
  }
  return next;
}

/** Constrain an endpoint to 45° steps around the origin (shift-drag arrows). */
export function snapAngle(origin: Point, p: Point): Point {
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  const len = Math.hypot(dx, dy);
  return { x: origin.x + Math.cos(angle) * len, y: origin.y + Math.sin(angle) * len };
}

/**
 * Auto-measure: flood-fill from a pixel by color similarity and return the
 * region's bounding box. BFS with a visit budget so a click on a large
 * uniform background stays fast (returns null → caller falls back to drag).
 */
export function floodBounds(
  data: ImageData,
  startX: number,
  startY: number,
  tolerance = 28,
  budget = 400_000,
): { x1: number; y1: number; x2: number; y2: number } | null {
  const { width, height, data: px } = data;
  const sx = Math.round(startX);
  const sy = Math.round(startY);
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return null;
  const base = (sy * width + sx) * 4;
  const [r0, g0, b0] = [px[base], px[base + 1], px[base + 2]];
  const match = (i: number) =>
    Math.abs(px[i] - r0) <= tolerance &&
    Math.abs(px[i + 1] - g0) <= tolerance &&
    Math.abs(px[i + 2] - b0) <= tolerance;

  const visited = new Uint8Array(width * height);
  const queue: number[] = [sy * width + sx];
  visited[queue[0]] = 1;
  let minX = sx;
  let maxX = sx;
  let minY = sy;
  let maxY = sy;
  let count = 0;

  while (queue.length > 0) {
    const idx = queue.pop()!;
    if (++count > budget) return null; // region too large to be a "target"
    const x = idx % width;
    const y = (idx / width) | 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    const neighbors = [idx - 1, idx + 1, idx - width, idx + width];
    for (const n of neighbors) {
      if (n < 0 || n >= width * height || visited[n]) continue;
      const nx = n % width;
      if (Math.abs(nx - x) > 1) continue; // row wrap
      if (match(n * 4)) {
        visited[n] = 1;
        queue.push(n);
      }
    }
  }
  if (maxX - minX < 2 || maxY - minY < 2) return null;
  return { x1: minX, y1: minY, x2: maxX + 1, y2: maxY + 1 };
}
