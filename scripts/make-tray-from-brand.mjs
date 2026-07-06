// Derives the menu-bar template icon from the Accessibility.build brand mark
// (scripts/brand-icon-512.png — white "A" on a black disc). A macOS template
// icon is a monochrome alpha mask that the system tints for light/dark menu
// bars, so we keep the white glyph as opacity and drop the black disc.
//   node scripts/make-tray-from-brand.mjs
import { inflateSync, deflateSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const OUT_SIZE = 44; // 22pt @2x

// ---------- decode PNG (8-bit RGBA, non-interlaced) ----------
function decodePng(buf) {
  let pos = 8; // skip signature
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + len;
  }
  if (colorType !== 6) throw new Error(`expected RGBA PNG, got color type ${colorType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = width * bpp;
  const out = Buffer.alloc(width * height * bpp);
  let rp = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++];
    for (let x = 0; x < stride; x++) {
      const cur = raw[rp++];
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let val;
      switch (filter) {
        case 0: val = cur; break;
        case 1: val = cur + a; break;
        case 2: val = cur + b; break;
        case 3: val = cur + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          val = cur + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`bad filter ${filter}`);
      }
      out[y * stride + x] = val & 0xff;
    }
  }
  return { width, height, pixels: out };
}

// ---------- encode PNG (8-bit RGBA) ----------
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b) => {
  let c = 0xffffffff;
  for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
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
    px.subarray(y * size * 4, (y + 1) * size * 4).copy(raw, y * (size * 4 + 1) + 1);
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

// ---------- build the template ----------
const src = decodePng(readFileSync(join(here, "brand-icon-512.png")));
const out = Buffer.alloc(OUT_SIZE * OUT_SIZE * 4);
const block = src.width / OUT_SIZE;

for (let oy = 0; oy < OUT_SIZE; oy++) {
  for (let ox = 0; ox < OUT_SIZE; ox++) {
    // box-average the source region → luminance weighted by source alpha
    let sum = 0;
    let count = 0;
    const x0 = Math.floor(ox * block);
    const y0 = Math.floor(oy * block);
    const x1 = Math.floor((ox + 1) * block);
    const y1 = Math.floor((oy + 1) * block);
    for (let sy = y0; sy < y1; sy++) {
      for (let sx = x0; sx < x1; sx++) {
        const i = (sy * src.width + sx) * 4;
        const lum = 0.299 * src.pixels[i] + 0.587 * src.pixels[i + 1] + 0.114 * src.pixels[i + 2];
        const alpha = src.pixels[i + 3] / 255;
        sum += lum * alpha; // white glyph on black → glyph is bright
        count++;
      }
    }
    const o = (oy * OUT_SIZE + ox) * 4;
    out[o] = 0; // template: color is black, tinted by macOS
    out[o + 1] = 0;
    out[o + 2] = 0;
    out[o + 3] = Math.round(Math.min(255, Math.max(0, (sum / count / 255) * 255)));
  }
}

const dest = join(here, "..", "apps", "desktop", "src-tauri", "icons", "tray.png");
writeFileSync(dest, encodePng(out, OUT_SIZE));
console.log(`wrote ${dest}`);
