// Шинэ брэнд лого (app/carcare-1f-dark.png, app/carcare-1f-light.png)-оос
// UI asset-уудыг үүсгэнэ:
//   - public/brand/mark-dark.png / mark-light.png  (араат тэмдэг дангаараа, 512x512)
//   - public/brand/logo-dark.png / logo-light.png  (бүтэн lockup — тэмдэг + Carcare үг)
//   - app/icon.png                                 (favicon-ы эх — light хувилбарын тэмдэг)
// Ажиллуулах: node scripts/make-brand-assets.mjs && node scripts/make-favicons.mjs
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "public", "brand");

// Эх зургийн доод ~38% нь "Carcare" үг — тэмдгийг дээд хэсгээс тайрч авна.
const MARK_TOP_RATIO = 0.66;

/** Тунгалаг захыг тайрч, төвд нь байрлуулсан квадрат PNG буцаана. */
async function toSquare(buffer, size) {
  const trimmed = await sharp(buffer).trim().toBuffer({ resolveWithObject: true });
  const { width, height } = trimmed.info;
  const side = Math.max(width, height);
  return sharp(trimmed.data)
    .extend({
      top: Math.floor((side - height) / 2),
      bottom: Math.ceil((side - height) / 2),
      left: Math.floor((side - width) / 2),
      right: Math.ceil((side - width) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .resize(size, size)
    .png()
    .toBuffer();
}

async function processVariant(variant) {
  const src = path.join(root, "app", `carcare-1f-${variant}.png`);
  const meta = await sharp(src).metadata();

  // Бүтэн lockup — тунгалаг захыг л тайрна.
  await sharp(src).trim().png().toFile(path.join(OUT, `logo-${variant}.png`));
  console.log(`✓ public/brand/logo-${variant}.png`);

  // Тэмдэг дангаараа — дээд хэсгийг тайрч, квадрат болгоно.
  const top = await sharp(src)
    .extract({
      left: 0,
      top: 0,
      width: meta.width,
      height: Math.round(meta.height * MARK_TOP_RATIO),
    })
    .toBuffer();
  const mark = await toSquare(top, 512);
  await sharp(mark).toFile(path.join(OUT, `mark-${variant}.png`));
  console.log(`✓ public/brand/mark-${variant}.png`);

  return mark;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await processVariant("dark");
  const lightMark = await processVariant("light");

  // Favicon-ы эх: light хувилбарын тод ягаан тэмдэг — цагаан ч, бараан ч tab дээр уншигдана.
  await sharp(lightMark).toFile(path.join(root, "app", "icon.png"));
  console.log("✓ app/icon.png (favicon-ы эх)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
