/**
 * Эмзэг утга (QPay merchant нууц үг, token г.м.)-г DB-д шифрлэж хадгалах.
 *
 * AES-256-GCM (authenticated encryption). Түлхүүрийг `ENCRYPTION_KEY` (эсвэл
 * түүнгүй бол `SESSION_SECRET`)-аас sha256-аар гаргана. Формат:
 *   "enc:v1:" + base64( iv(12) | authTag(16) | ciphertext )
 *
 * `decryptSecret` нь "enc:v1:" prefix-гүй утгыг **хуучин plaintext** гэж үзэж
 * хэвээр буцаана — ингэснээр одоо байгаа мөрүүдийг нэг дор migrate хийхгүйгээр
 * аажмаар (write дээр шифрлэгдэнэ) шилжүүлэх боломжтой.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";
const IV_LENGTH = 12; // GCM-д зориулсан стандарт
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? process.env.SESSION_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error(
      "ENCRYPTION_KEY (эсвэл SESSION_SECRET) тохируулагдсан байх ёстой (32+ тэмдэгт).",
    );
  }
  // Дурын урттай secret-г 32 байт болгож normalize хийнэ.
  return createHash("sha256").update(raw).digest();
}

/** Plaintext-г шифрлэж "enc:v1:..." мөр болгож буцаана. Хоосон бол хэвээр. */
export function encryptSecret(plaintext: string | null | undefined): string {
  if (!plaintext) return "";
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

/**
 * "enc:v1:..." мөрийг тайлж буцаана. Prefix-гүй (хуучин plaintext) утгыг хэвээр,
 * null/хоосныг null буцаана.
 */
export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith(PREFIX)) return value; // legacy plaintext
  const raw = Buffer.from(value.slice(PREFIX.length), "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    "utf8",
  );
}

/** Утга аль хэдийн шифрлэгдсэн эсэх (хуучин plaintext эсэхийг ялгахад). */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}
