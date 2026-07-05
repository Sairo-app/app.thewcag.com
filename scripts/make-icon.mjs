// Generates scripts/icon-source.png (1024x1024) with zero dependencies:
// a dark rounded field with a half-light/half-dark disc — the contrast motif.
// Feed the output to `pnpm tauri icon` to produce all platform icons.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 1024;
const C = SIZE / 2;

const BG = [15, 23, 42]; // slate-950
const LIGHT = [248, 250, 252]; // slate-50
const DARK = [30, 41, 59]; // slate-800
const RING = [245, 158, 11]; // amber-500

const px = new Uint8Array(SIZE * SIZE * 4);

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4;
    const dx = x - C;
    const dy = y - C;
    const d = Math.hypot(dx, dy);

    let color = null;
    let alpha = 0;
    if (d <= 480) {
      // outer field
      color = BG;
      alpha = 255;
      if (d >= 330 && d <= 358) color = RING;
      else if (d < 330) color = x < C ? LIGHT : DARK;
    }
    if (color) {
      px[i] = color[0];
      px[i + 1] = color[1];
      px[i + 2] = color[2];
      px[i + 3] = alpha;
    }
  }
}

// --- minimal PNG encoder (8-bit RGBA, filter 0) ---
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0;
  Buffer.from(px.buffer, y * SIZE * 4, SIZE * 4).copy(raw, y * (SIZE * 4 + 1) + 1);
}

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

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = join(dirname(fileURLToPath(import.meta.url)), "icon-source.png");
writeFileSync(out, png);
console.log(`wrote ${out} (${png.length} bytes)`);
