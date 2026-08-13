import { formatPhone } from "@/lib/phone";

// Нэр байхгүй үед автоматаар тавьдаг placeholder-ууд — эдгээрийг "нэргүй" гэж
// үзэж, оронд нь утасны дугаарыг харуулна.
const PLACEHOLDER_NAMES = new Set([
  "Нэргүй",
  "Цаг захиалсан хэрэглэгч",
  "Цаг захиалсан үйлчлүүлэгч",
]);

// Үйлчлүүлэгчийн дэлгэцэнд харуулах нэр. Бодит нэр байвал түүнийг, эс бөгөөс
// (хоосон эсвэл placeholder) утасны дугаарыг форматлаж харуулна. Placeholder
// текст ("Нэргүй", "Цаг захиалсан хэрэглэгч") хаана ч харагдахгүй.
// Сервер ба клиент component хоёуланд хэрэглэнэ.
export function customerLabel(
  c: { fullName?: string | null; phone?: string | null } | null | undefined,
): string {
  const name = c?.fullName?.trim();
  if (name && !PLACEHOLDER_NAMES.has(name)) return name;
  const phone = c?.phone?.trim();
  if (phone) return formatPhone(phone);
  return "Нэргүй";
}
