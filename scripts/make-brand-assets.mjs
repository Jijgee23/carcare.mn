// Шинэ брэнд лого (app/carservice-icon-amber.png, app/carservice-1f-amber.png)-оос
// UI asset-уудыг үүсгэнэ (нэг л өнгийн хувилбар — амбер, dark/light хуваагдалгүй):
//   - public/brand/mark.png  (тэмдэг дангаараа, 512x512)
//   - public/brand/logo.png  (бүтэн lockup — тэмдэг + Carservice үг)
//   - app/icon.png           (favicon-ы эх)
// Ажиллуулах: node scripts/make-brand-assets.mjs && node scripts/make-favicons.mjs
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "public", "brand");

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

async function main() {
  await mkdir(OUT, { recursive: true });

  // Бүтэн lockup (тэмдэг + "carservice" үг нэг зурагт) — тунгалаг захыг л тайрна.
  const logoSrc = path.join(root, "app", "carservice-1f-amber.png");
  await sharp(logoSrc).trim().png().toFile(path.join(OUT, "logo.png"));
  console.log("✓ public/brand/logo.png");

  // Тэмдэг дангаараа — аль хэдийн квадрат ирсэн ч, тайрч/төвлөрүүлж 512x512 болгоно.
  const iconSrc = path.join(root, "app", "carservice-icon-amber.png");
  const mark = await toSquare(await sharp(iconSrc).toBuffer(), 512);
  await sharp(mark).toFile(path.join(OUT, "mark.png"));
  console.log("✓ public/brand/mark.png");

  // Favicon-ы эх — амбер тэмдэг цагаан ч, бараан ч tab дээр уншигдана (тунгалаг арктай).
  await sharp(mark).toFile(path.join(root, "app", "icon.png"));
  console.log("✓ app/icon.png (favicon-ы эх)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
