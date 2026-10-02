// QA #14: машин хүлээн авах — чөлөөт тэмдэглэл, зураг, үйлчлүүлэгчийн гарын үсэг.
// Зөвхөн захиалга үүсгэх үед бичигдэж, үүссэний дараа бүрмөсөн түгжигдэнэ.
//
// Server action-ийн body 4MB (next.config.ts) тул зураг бүрийг сонгосон даруйд
// тусдаа хүсэлтээр "staging" хийнэ; захиалга үүсгэх submit нь зөвхөн staged
// замуудыг илгээж, сервер тэдгээрийг шалгаад захиалгатай нэг transaction-д
// холбоно. Үүсгэлгүй орхисон staged файл диск дээр үлдэнэ (мэдэгдэж буй).

// Client-д ч импортлогддог тул энд зөвхөн тогтмол/цэвэр функц — node модуль
// хэрэгтэй хэсэг order-intake-server.ts-д.

export const INTAKE_NOTES_MAX = 5000;
export const INTAKE_PHOTOS_MAX = 20;

/** Хэрэглэгч бүрийн staging хавтас — өөр хэрэглэгчийн файлыг claim хийж болохгүй. */
export function intakeStagingSubdir(tenantId: string, userId: string): string {
  return `orders/${tenantId}/intake/${userId}`;
}

/** Хүлээн авах үеийн гүйлтийн дээд хязгаар (км). */
export const INTAKE_MILEAGE_MAX = 2_000_000;
export const INTAKE_MILEAGE_ERROR = "Гүйлт 0–2,000,000 км байх ёстой.";

/** 152300 → "152,300 км" (en-US: server/client-д ижил). */
export function formatMileageKm(km: number): string {
  return `${km.toLocaleString("en-US")} км`;
}
