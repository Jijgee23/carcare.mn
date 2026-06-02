// CC лого (app/icon.png)-оос web icon-уудыг үүсгэнэ:
//   - app/favicon.ico  (16/32/48 px, PNG-embedded ICO — /favicon.ico-д үйлчилнэ)
//   - app/apple-icon.png (180x180 — iOS home screen)
// Ажиллуулах: node scripts/make-favicons.mjs
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(root, "app", "icon.png");

/** PNG payload-уудыг агуулсан .ico container угсарна (Vista+ дэмждэг). */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(images.length, 4);

  const entries = Buffer.alloc(16 * images.length);
  let offset = 6 + 16 * images.length;
  for (let i = 0; i < images.length; i++) {
    const { size, buffer } = images[i];
    const e = entries.subarray(i * 16, i * 16 + 16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 => 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // palette count
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(buffer.length, 8); // image data size
    e.writeUInt32LE(offset, 12); // image data offset
    offset += buffer.length;
  }

  return Buffer.concat([header, entries, ...images.map((i) => i.buffer)]);
}

async function main() {
  const src = await readFile(SRC);

  const sizes = [16, 32, 48];
  const pngs = await Promise.all(
    sizes.map(async (size) => ({
      size,
      buffer: await sharp(src)
        .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer(),
    })),
  );

  await writeFile(path.join(root, "app", "favicon.ico"), buildIco(pngs));
  console.log("✓ app/favicon.ico (16/32/48)");

  await sharp(src)
    .resize(180, 180, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(root, "app", "apple-icon.png"));
  console.log("✓ app/apple-icon.png (180x180)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
