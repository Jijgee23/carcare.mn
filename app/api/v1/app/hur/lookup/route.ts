import { enforceRateLimit, jsonError, jsonOk } from "@/lib/api";
import { getApiAccountFromRequest } from "@/lib/auth/account-api-token";
import { HurService, toPublicVehicle } from "@/lib/hur_service";

/**
 * Мобайл аппаас дуудах HUR lookup. Account bearer token-аар auth.
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

  try {
    const vehicle = toPublicVehicle(await HurService.getVehicle(plate));
    return jsonOk({ vehicle });
  } catch (e) {
    return jsonError(502, e instanceof Error ? e.message : "HUR алдаа гарлаа.");
  }
}
