import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

const PUBLIC_DIR = path.join(process.cwd(), "public");

export type SavedFile = {
  path: string; // /uploads/.../filename.png — энэ нь browser-аас хандах URL
  size: number;
  mime: string;
};

/**
 * FormData дотроос ирсэн File-г /public/uploads/<subdir>/ дотор хадгална.
 * Validation: mime, хэмжээ.
 */
export async function saveUpload(
  file: File,
  subdir = "logos",
): Promise<SavedFile> {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error("Зөвхөн PNG, JPG, WEBP, SVG зураг зөвшөөрөгдөнө.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Файлын хэмжээ 2MB-аас хэтэрсэн байна.");
  }
  if (file.size === 0) {
    throw new Error("Хоосон файл оруулсан байна.");
  }

  const ext = EXT_BY_MIME[file.type] ?? "bin";
  const name = `${randomBytes(12).toString("hex")}.${ext}`;

  const targetDir = path.join(PUBLIC_DIR, "uploads", subdir);
  await mkdir(targetDir, { recursive: true });

  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(targetDir, name), buf);

  return {
    path: `/uploads/${subdir}/${name}`,
    size: file.size,
    mime: file.type,
  };
}
