import { enforceRateLimit, jsonError, jsonOk, requireApiUser, upstreamErrorResponse } from "@/lib/api";
import { HurService } from "@/lib/hur_service";
import { findTenantCustomerIdByPhone, toLookupOwner } from "@/lib/hur-lookup";
import { prisma } from "@/lib/prisma";
import { normalizePlate, vehicleToLookupInfo } from "@/lib/vehicles";

/**
 * Мобайл клиентэд зориулсан машины lookup. Bearer token-аар auth.
 * Эхлээд global Vehicle бүртгэлээс хайж, байхгүй үед л HUR-аас татна.
 * GET /api/v1/hur/vehicle?plate=1234ABC
 */
export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  // Үндэсний бүртгэлийн PII-г scrape хийх / нийтийн HUR квотыг шавхахаас
  // сэргийлж хэрэглэгч тус бүрээр throttle.
  const limited = enforceRateLimit(
    req,
    "hur",
    { limit: 20, windowMs: 60_000 },
    auth.user.id,
  );
  if (limited) return limited;

  const url = new URL(req.url);
  const plate = url.searchParams.get("plate")?.trim() ?? "";
  if (!plate) return jsonError(400, "Улсын дугаар шаардлагатай.");

  // Системд аль хэдийн бүртгэлтэй бол HUR дуудалгүй шууд ашиглана. Ижил
  // дугаартай мөр олон байж болно (эзэн тус бүрт) — техник шинж ижил тул
  // хамгийн сүүлд шинэчлэгдсэнийг авна.
  const canonPlate = normalizePlate(plate);
  const existing = await prisma.vehicle.findFirst({
    where: { plate: canonPlate },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) {
    // Эзний мэдээлэл зөвхөн ӨӨРИЙН tenant-ийн холбоосоос (өөр tenant-ийн PII
    // задруулахгүй). Бүтэн утас/регистр/хаяг гарахгүй — маскалсан утас + kind.
    const ownerLink = await prisma.tenantVehicle.findFirst({
      where: { tenantId: auth.user.tenantId, vehicle: { plate: canonPlate } },
      orderBy: { updatedAt: "desc" },
      select: { customer: { select: { fullName: true, phone: true } } },
    });
    const owner = ownerLink?.customer
      ? toLookupOwner({
          firstName: ownerLink.customer.fullName || null,
          lastName: null,
          phone: ownerLink.customer.phone,
          regnum: existing.ownerRegnum,
          type: null,
        })
      : null;
    const matchedCustomerId = ownerLink?.customer
      ? await findTenantCustomerIdByPhone(auth.user.tenantId, ownerLink.customer.phone)
      : null;
    return jsonOk({
      vehicle: { ...vehicleToLookupInfo(existing), owner },
      source: "global",
      registered: Boolean(ownerLink),
      matchedCustomerId,
    });
  }

  try {
    const vehicle = await HurService.getVehicle(canonPlate);
    const { owner: rawOwner, ...rest } = vehicle;
    const matchedCustomerId = rawOwner?.phone
      ? await findTenantCustomerIdByPhone(auth.user.tenantId, rawOwner.phone)
      : null;
    return jsonOk({
      vehicle: { ...rest, owner: rawOwner ? toLookupOwner(rawOwner) : null },
      source: "hur",
      matchedCustomerId,
    });
  } catch (e) {
    return upstreamErrorResponse("hur-vehicle", e, "HUR алдаа гарлаа.");
  }
}
