// Үйлчлүүлэгчийн дэлгэцэнд харуулах нэр.
// Овог нэр заавал биш болсон тул хоосон үед "Нэргүй" гэж харуулна. Утас нь
// ихэнх дэлгэцэд тусдаа багана / hint-ээр харагддаг тул давхардуулахгүй.
// Сервер ба клиент component хоёуланд хэрэглэнэ.
export function customerLabel(
  c: { fullName?: string | null } | null | undefined,
): string {
  return c?.fullName?.trim() || "Нэргүй";
}
