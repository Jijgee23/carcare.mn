/**
 * Ажилтны нэвтрэх нэр — имэйл ЭСВЭЛ утасны дугаар. `User.email`, `User.phone`
 * хоёулаа глобал unique тул аль нэгээр нь хэрэглэгчийг яг нэгээр олно.
 *
 * OTP нь (email, type)-аар түлхүүрлэгддэг (lib/auth/otp.ts) — утсаар орсон ч
 * хэрэглэгчийг олсны дараа issue/verify-д `user.email`-ийг ашиглана. Утсаар
 * орсон клиент рүү хэрэглэгчийн имэйлийг буцааж ил гаргахгүй.
 *
 * Веб (app/_actions/auth.ts) болон мобайл API (app/api/v1/auth/*) хоёул энийг
 * ашиглана.
 */

import { normalizePhone } from "@/lib/phone";

export type LoginIdentifier = { email: string } | { phone: string };

export const IDENTIFIER_ERROR = "Имэйл эсвэл утасны дугаар буруу.";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Түүхий оруулгыг задлана: имэйл → `{ email }` (lowercase), утас → `{ phone }` (канон 8 орон). */
export function parseLoginIdentifier(raw: unknown): LoginIdentifier | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v) return null;
  const lower = v.toLowerCase();
  if (EMAIL_RE.test(lower)) return { email: lower };
  const phone = normalizePhone(v);
  return phone ? { phone } : null;
}

/**
 * JSON body-оос нэвтрэх нэрийг уншина — `identifier`, эсвэл хуучин клиентийн
 * `email` / `phone` талбар (backward-compat).
 */
export function loginIdentifierFromBody(body: unknown): LoginIdentifier | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { identifier?: unknown; email?: unknown; phone?: unknown };
  for (const raw of [b.identifier, b.email, b.phone]) {
    if (typeof raw === "string" && raw.trim()) return parseLoginIdentifier(raw);
  }
  return null;
}

/** Клиент руу буцаах канон утга (имэйл lowercase / 8 оронтой утас). */
export function loginIdentifierValue(id: LoginIdentifier): string {
  return "email" in id ? id.email : id.phone;
}

/** Хариуны мессежид: "имэйл" / "утасны дугаар". */
export function loginIdentifierLabel(id: LoginIdentifier): string {
  return "email" in id ? "имэйл" : "утасны дугаар";
}
