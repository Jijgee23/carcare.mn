import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { HurService } from "@/lib/hur_service";

/**
 * Dashboard-аас дуудах HUR lookup. Session-аар auth хийнэ.
 * GET /api/hur/lookup?plate=1234ABC
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай." }, { status: 401 });
  }

  // PII scrape / квот шавхалтаас сэргийлж хэрэглэгч тус бүрээр throttle.
  const limited = enforceRateLimit(
    req,
    "hur",
    { limit: 20, windowMs: 60_000 },
    session.userId,
  );
  if (limited) return limited;

  const url = new URL(req.url);
  const plate = url.searchParams.get("plate")?.trim() ?? "";
  if (!plate) {
    return NextResponse.json(
      { error: "Улсын дугаар шаардлагатай." },
      { status: 400 },
    );
  }

  try {
    const vehicle = await HurService.getVehicle(plate);
    return NextResponse.json({ vehicle });
  } catch (e) {
    const message = e instanceof Error ? e.message : "HUR алдаа гарлаа.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
