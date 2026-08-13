import { enforceRateLimit, jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { HurService } from "@/lib/hur_service";
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

  // Системд аль хэдийн бүртгэлтэй бол HUR дуудалгүй шууд ашиглана.
  const canonPlate = normalizePlate(plate);
  const existing = await prisma.vehicle.findUnique({
    where: { plate: canonPlate },
  });
  if (existing) {
    return jsonOk({
      vehicle: { ...vehicleToLookupInfo(existing), owner: null },
      source: "global",
    });
  }

  try {
    const vehicle = await HurService.getVehicle(canonPlate);
    return jsonOk({ vehicle, source: "hur" });
  } catch (e) {
    return jsonError(
      502,
      e instanceof Error ? e.message : "HUR алдаа гарлаа.",
    );
  }
}
