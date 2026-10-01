import { Prisma } from "@/app/generated/prisma/client";

/**
 * Form/JSON-оос ирсэн сөрөг биш тоог (үнэ, үлдэгдэл, хугацаа) Decimal болгоно.
 * Мянгатын таслал, зай хасна. "10ш", "1.2.3", "1e5" зэрэг буруу утгад null
 * буцаана — `new Prisma.Decimal()` throw хийж server action-ийг унагахгүй.
 */
export function parseNonNegativeDecimal(raw: unknown): Prisma.Decimal | null {
  const str = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw : "";
  const cleaned = str.replace(/[,\s]/g, "");
  if (!cleaned || !/^\d+(?:\.\d+)?$/.test(cleaned)) return null;
  try {
    return new Prisma.Decimal(cleaned);
  } catch {
    return null;
  }
}
