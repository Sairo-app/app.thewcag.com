import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "apps/web/public/logo.png");
const resources = join(root, "apps/desktop/resources");
const work = mkdtempSync(join(tmpdir(), "thewcag-icons-"));
const square = join(work, "icon-1024.png");

function run(command, args) {
  execFileSync(command, args, { stdio: "inherit" });
}

function makePng(size, output) {
  run("sips", ["-z", String(size), String(size), square, "--out", output]);
}

function writeIco(images, output) {
  const files = images.map(({ size, path }) => ({ size, data: readFileSync(path) }));
  const header = Buffer.alloc(6 + files.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(files.length, 4);
  let offset = header.length;
  files.forEach(({ size, data }, index) => {
    const entry = 6 + index * 16;
    header[entry] = size === 256 ? 0 : size;
    header[entry + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(0, entry + 2);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  writeFileSync(output, Buffer.concat([header, ...files.map(({ data }) => data)]));
}

mkdirSync(resources, { recursive: true });

try {
  run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    source,
    "-vf",
    "scale=820:820:force_original_aspect_ratio=decrease,pad=1024:1024:(ow-iw)/2:(oh-ih)/2:color=0x00000000",
    "-frames:v",
    "1",
    square,
  ]);

  copyFileSync(square, join(resources, "icon.png"));

  const iconset = join(work, "TheWCAG.iconset");
  mkdirSync(iconset);
  const macSizes = [
    [16, "icon_16x16.png"],
    [32, "icon_16x16@2x.png"],
    [32, "icon_32x32.png"],
    [64, "icon_32x32@2x.png"],
    [128, "icon_128x128.png"],
    [256, "icon_128x128@2x.png"],
    [256, "icon_256x256.png"],
    [512, "icon_256x256@2x.png"],
    [512, "icon_512x512.png"],
    [1024, "icon_512x512@2x.png"],
  ];
  for (const [size, name] of macSizes) makePng(size, join(iconset, name));
  run("iconutil", ["-c", "icns", iconset, "-o", join(resources, "icon.icns")]);

  const windows = [16, 32, 48, 64, 128, 256].map((size) => {
    const path = join(work, `icon-${size}.png`);
    makePng(size, path);
    return { size, path };
  });
  writeIco(windows, join(resources, "icon.ico"));

  console.log("Generated Electron icons from apps/web/public/logo.png");
} finally {
  rmSync(work, { recursive: true, force: true });
}
