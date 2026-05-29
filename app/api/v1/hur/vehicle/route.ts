import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { HurService } from "@/lib/hur_service";

/**
 * Мобайл клиентэд зориулсан HUR lookup. Bearer token-аар auth.
 * GET /api/v1/hur/vehicle?plate=1234ABC
 */
export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const plate = url.searchParams.get("plate")?.trim() ?? "";
  if (!plate) return jsonError(400, "Улсын дугаар шаардлагатай.");

  try {
    const vehicle = await HurService.getVehicle(plate);
    return jsonOk({ vehicle });
  } catch (e) {
    return jsonError(
      502,
      e instanceof Error ? e.message : "HUR алдаа гарлаа.",
    );
  }
}
