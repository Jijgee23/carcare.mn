import { Prisma } from "@/app/generated/prisma/client";

// Postgres FK violations: 23503 (foreign_key_violation, NO ACTION) and 23001
// (restrict_violation, `onDelete: Restrict`). Prisma only maps 23503 to P2003;
// with the pg driver adapter a RESTRICT violation surfaces as a raw
// DriverAdapterError whose `cause.originalCode` is "23001". Check all shapes.
const FK_SQLSTATES = new Set(["23503", "23001"]);

export function isForeignKeyViolation(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") return true;
  for (let cur: unknown = e, depth = 0; cur && typeof cur === "object" && depth < 4; depth++) {
    const o = cur as { code?: unknown; originalCode?: unknown; cause?: unknown };
    if (typeof o.originalCode === "string" && FK_SQLSTATES.has(o.originalCode)) return true;
    if (typeof o.code === "string" && (o.code === "P2003" || FK_SQLSTATES.has(o.code))) return true;
    cur = o.cause;
  }
  return false;
}
