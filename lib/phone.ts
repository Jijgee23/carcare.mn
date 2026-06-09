/**
 * Утасны дугаарын канон нормчлол.
 *
 * Онлайн цаг захиалгын гүүр (Account ↔ тенантын Customer) бүхэлдээ утсаар
 * түлхүүрлэгддэг тул бүх давхаргад ЯГ нэг канон формат ашиглах ёстой:
 *   - Account.phone (DB-д хадгалах)
 *   - Customer.phone-тэй тааруулах
 *   - OTP issue / verify
 *   - SMS gateway руу дамжуулах
 *
 * Канон формат = 8 оронтой Монгол дугаар, тусгай тэмдэг / улсын код / урд талын
 * 0-гүйгээр (ж: "99112233"). +976, 976, зай, зураас, 0-prefix-ийг арилгана.
 */

const MN_LOCAL_LENGTH = 8;
// Монгол дугаарын эхний орон: гар утас 6/7/8/9, суурин 1/5 г.м. Бид
// энгийнээр 5-9-өөр эхэлсэн 8 оронтойг хүлээн авна (гар утас + ихэнх суурин).
const MN_FIRST_DIGIT = /^[5-9]/;

/**
 * Дурын оруулгыг канон 8 оронтой дугаар болгоно. Хүчингүй бол null.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  const digits = (input ?? "").replace(/\D+/g, "");
  if (!digits) return null;

  let d = digits;
  // Улсын код 976 (нийт 11 орон) — хасна
  if (d.length === 11 && d.startsWith("976")) d = d.slice(3);
  // Зарим хүн урд нь 0 нэмдэг (09911...) — 9 орон бол хасна
  if (d.length === 9 && d.startsWith("0")) d = d.slice(1);

  if (d.length !== MN_LOCAL_LENGTH) return null;
  if (!MN_FIRST_DIGIT.test(d)) return null;
  return d;
}

/** Оруулга хүчинтэй Монгол дугаар эсэх. */
export function isValidPhone(input: string | null | undefined): boolean {
  return normalizePhone(input) !== null;
}

/** Канон дугаарыг харагдацад "9911-2233" хэлбэрээр форматлана. */
export function formatPhone(canonical: string): string {
  const d = normalizePhone(canonical);
  if (!d) return canonical;
  return `${d.slice(0, 4)}-${d.slice(4)}`;
}
