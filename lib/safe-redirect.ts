/**
 * "next" query параметрийг (харах: auth-ийн login→choose-branch урсгал)
 * бусад "буцах" урсгалд (захиалга/цаг захиалга үүсгэх) дахин ашиглах нэгдсэн
 * helper. Зөвхөн харьяа (site-ийн доторх, "/"-ээр эхэлсэн) зам зөвшөөрнө —
 * гадаад URL руу чиглүүлэх open-redirect эрсдэлээс сэргийлнэ.
 */
export function safeNext(raw: string | null | undefined, fallback: string): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return fallback;
}
