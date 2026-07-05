// Generates the app icon (scripts/icon-source.png, 1024x1024) and the
// menu-bar template icon (apps/desktop/src-tauri/icons/tray.png, 44x44)
// with zero dependencies. App icon: macOS-style rounded square, brand-blue
// vertical gradient, split contrast disc. Tray icon: monochrome template
// (black + alpha) so macOS tints it for light/dark menu bars.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// ---------- minimal PNG encoder ----------
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function encodePng(px, size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    Buffer.from(px.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// superellipse (squircle) membership test, |x/a|^n + |y/a|^n <= 1
function inSquircle(dx, dy, radius, n = 4.6) {
  return Math.pow(Math.abs(dx) / radius, n) + Math.pow(Math.abs(dy) / radius, n) <= 1;
}

// ---------- app icon 1024 ----------
{
  const SIZE = 1024;
  const C = SIZE / 2;
  const px = new Uint8Array(SIZE * SIZE * 4);
  // brand gradient: blue-500 → blue-700
  const TOP = [59, 130, 246];
  const BOT = [29, 78, 216];
  const LIGHT = [248, 250, 252];
  const DARK = [15, 23, 42];

  const R = 470; // squircle radius (Apple icons bleed close to the edge)
  const DISC = 300;

  for (let y = 0; y < SIZE; y++) {
    const t = y / SIZE;
    const bg = [
      Math.round(TOP[0] + (BOT[0] - TOP[0]) * t),
      Math.round(TOP[1] + (BOT[1] - TOP[1]) * t),
      Math.round(TOP[2] + (BOT[2] - TOP[2]) * t),
    ];
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const dx = x - C;
      const dy = y - C;
      if (!inSquircle(dx, dy, R)) continue;
      let color = bg;
      const d = Math.hypot(dx, dy);
      if (d <= DISC) {
        // split disc: the contrast motif
        color = dx < 0 ? LIGHT : DARK;
        // thin white seam down the middle reads as a picker line
        if (Math.abs(dx) < 7) color = LIGHT;
      } else if (d <= DISC + 26 && d >= DISC + 10) {
        color = LIGHT; // ring
      }
      px[i] = color[0];
      px[i + 1] = color[1];
      px[i + 2] = color[2];
      px[i + 3] = 255;
    }
  }
  const out = join(here, "icon-source.png");
  writeFileSync(out, encodePng(px, SIZE));
  console.log(`wrote ${out}`);
}

// ---------- tray template icon 44x44 (22pt @2x) ----------
{
  const SIZE = 44;
  const C = SIZE / 2;
  const px = new Uint8Array(SIZE * SIZE * 4);
  const R_OUT = 19;
  const R_IN = 15;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const dx = x - C + 0.5;
      const dy = y - C + 0.5;
      const d = Math.hypot(dx, dy);
      let alpha = 0;
      // ring
      if (d <= R_OUT && d >= R_OUT - 2.6) alpha = 255;
      // left half-disc filled
      if (d <= R_IN && dx <= 0) alpha = 255;
      // soft edges
      if (alpha === 0) {
        if (Math.abs(d - R_OUT + 1.3) < 2) alpha = Math.max(0, 255 - Math.abs(d - (R_OUT - 1.3)) * 180);
        if (dx <= 0 && Math.abs(d - R_IN) < 1) alpha = Math.max(alpha, 128);
      }
      px[i] = 0;
      px[i + 1] = 0;
      px[i + 2] = 0;
      px[i + 3] = Math.min(255, alpha);
    }
  }
  const dir = join(here, "..", "apps", "desktop", "src-tauri", "icons");
  mkdirSync(dir, { recursive: true });
  const out = join(dir, "tray.png");
  writeFileSync(out, encodePng(px, SIZE));
  console.log(`wrote ${out}`);
}
