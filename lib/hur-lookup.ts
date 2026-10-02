import { HurService, ownerKindFromRegnum } from "@/lib/hur_service";
import type { HurVehicle } from "@/lib/hur_service";
import { normalizePhone } from "@/lib/phone";
import { maskOwnerPhone } from "@/lib/pii-mask";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";

/**
 * Dashboard lookup-ийн browser-д гарах эзэмшигч. Бүтэн утас/регистр/хаяг ЭНД
 * ОРОХГҮЙ — зөвхөн маскалсан утас + харьяаллын төрөл (kind).
 */
export type LookupOwner = {
  firstName: string | null;
  lastName: string | null;
  phone: string | null; // маскалсан "99••••82"
  regnum: null; // PII — browser-д огт гаргахгүй (kind-ийг сервер тооцно)
  type: string | null;
  address: null;
  kind: "Байгууллага" | "Хувь хүн" | null;
};

export type LookupVehicle = Omit<HurVehicle, "owner"> & { owner: LookupOwner | null };

type RawOwner = {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  regnum: string | null;
  type: string | null;
};

export function toLookupOwner(raw: RawOwner): LookupOwner {
  return {
    firstName: raw.firstName,
    lastName: raw.lastName,
    phone: raw.phone ? maskOwnerPhone(raw.phone) || null : null,
    regnum: null,
    type: raw.type,
    address: null,
    kind: ownerKindFromRegnum(raw.regnum),
  };
}

/** Энэ tenant-ийн, утас нь эзэмшигчийнхтэй таарах үйлчлүүлэгчийн id (эсвэл null). */
export async function findTenantCustomerIdByPhone(
  tenantId: string,
  phone: string | null | undefined,
): Promise<string | null> {
  const canon = normalizePhone(phone);
  if (!canon) return null;
  const found = await prisma.customer.findFirst({
    where: { tenantId, OR: [{ phone: canon }, { phone: { endsWith: canon } }] },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return found?.id ?? null;
}

export type ResolvedOwner = { fullName: string; phone: string; regnum: string | null };

/**
 * Lookup route-тай ЯГ ижил дарааллаар эзэмшигчийг сервер талд бүрэн утсаар нь
 * шийднэ: tenant-ийн холбоос → (global бүртгэл байвал эзэнгүй) → HUR.
 * HUR дуудалт cache-гүй (зөвхөн access token cache-тэй) — action бүр 1 HTTP.
 */
export async function resolveOwnerForPlate(
  tenantId: string,
  canonPlate: string,
): Promise<ResolvedOwner | null> {
  const link = await prisma.tenantVehicle.findFirst({
    where: { tenantId, vehicle: { plate: canonPlate } },
    orderBy: { updatedAt: "desc" },
    select: {
      customer: { select: { fullName: true, phone: true } },
      vehicle: { select: { ownerRegnum: true } },
    },
  });
  if (link?.customer) {
    return {
      fullName: link.customer.fullName,
      phone: link.customer.phone,
      regnum: link.vehicle.ownerRegnum,
    };
  }
  const existing = await prisma.vehicle.findFirst({
    where: { plate: canonPlate },
    select: { id: true },
  });
  if (existing) return null;

  const hur = await HurService.getVehicle(canonPlate);
  if (!hur.owner?.phone) return null;
  return {
    fullName: `${hur.owner.lastName ?? ""} ${hur.owner.firstName ?? ""}`.trim(),
    phone: hur.owner.phone,
    regnum: hur.owner.regnum,
  };
}

/**
 * Lookup-аас шинээр үүсэх машины эзэмшигчийн регистрийг сервер талд шийднэ
 * (browser-д огт гаргахгүй). Эх сурвалжийн дараалал: global Vehicle.ownerRegnum
 * (байвал HUR дуудахгүй) → глобал бүртгэл байгаа боловч регистргүй бол null →
 * HUR. Tenant-ийн мэдээлэл ашиглахгүй.
 */
export async function resolveOwnerRegnumForNewVehicle(
  canonPlate: string,
  userId: string,
): Promise<string | null> {
  const existing = await prisma.vehicle.findFirst({
    where: { plate: canonPlate },
    select: { ownerRegnum: true },
  });
  if (existing) return existing.ownerRegnum;
  // Lookup route/action-тай ЯГ ижил "hur:<userId>" bucket — зөвхөн HUR салбарт.
  // Хязгаарт хүрсэн бол HUR-гүй (регистргүй) үргэлжилнэ.
  if (!consumeRateLimit(`hur:${userId}`, { limit: 20, windowMs: 60_000 }).ok) return null;
  const hur = await HurService.getVehicle(canonPlate);
  return hur.owner?.regnum?.trim() || null;
}
