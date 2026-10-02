/**
 * Browser-д гарах PII-г сервер талд нуух pure helper-үүд.
 * (lib/phone.ts-ийн maskPhone нь OTP-ийн "******33" хэлбэр — энэ нь эзэмшигчийн
 * утсыг харуулах "99••••82" хэлбэр.)
 */

const BULLET = "•";

/**
 * Утсыг эхний 2 + сүүлийн 2 цифрийг үлдээж маскална: "99385882" → "99••••82".
 * Тоо биш тэмдэгтийг хасна. 6 ба түүнээс цөөн цифр бол бүгдийг нууна (үлдээвэл
 * бүтнээр ил болно). Хоосон/null → "".
 */
export function maskOwnerPhone(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.length <= 6) return BULLET.repeat(digits.length);
  return `${digits.slice(0, 2)}${BULLET.repeat(digits.length - 4)}${digits.slice(-2)}`;
}
