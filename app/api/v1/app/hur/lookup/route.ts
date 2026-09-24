import { enforceRateLimit, jsonError, jsonOk, upstreamErrorResponse } from "@/lib/api";
import { getApiAccountFromRequest } from "@/lib/auth/account-api-token";
import { HurService, toPublicVehicle } from "@/lib/hur_service";
import { prisma } from "@/lib/prisma";
import { normalizePlate, vehicleToLookupInfo } from "@/lib/vehicles";

/**
 * Мобайл аппаас дуудах машины lookup. Account bearer token-аар auth.
 * Эхлээд global Vehicle бүртгэлээс хайж, байхгүй үед л HUR-аас татна.
 * Өмчлөгчийн PII буцаахгүй.
 * GET /api/v1/app/hur/lookup?plate=1234УБА
 */
export async function GET(req: Request) {
  const account = await getApiAccountFromRequest(req);
  if (!account) return jsonError(401, "Нэвтрэх шаардлагатай.");

  const limited = enforceRateLimit(
    req,
    "hur-app",
    { limit: 20, windowMs: 60_000 },
    account.id,
  );
  if (limited) return limited;

  const plate = new URL(req.url).searchParams.get("plate")?.trim() ?? "";
  if (!plate) return jsonError(400, "Улсын дугаар шаардлагатай.");

  // Системд аль хэдийн бүртгэлтэй бол HUR дуудалгүй шууд ашиглана. Ижил
  // дугаартай мөр олон байж болно (эзэн тус бүрт) — сүүлд шинэчлэгдсэнийг авна.
  const canonPlate = normalizePlate(plate);
  const existing = await prisma.vehicle.findFirst({
    where: { plate: canonPlate },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) {
    return jsonOk({ vehicle: vehicleToLookupInfo(existing), source: "global" });
  }

  try {
    const vehicle = toPublicVehicle(await HurService.getVehicle(canonPlate));
    return jsonOk({ vehicle, source: "hur" });
  } catch (e) {
    return upstreamErrorResponse("hur-lookup", e, "HUR алдаа гарлаа.");
  }
}
