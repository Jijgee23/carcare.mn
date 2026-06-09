import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/api";
import { getAccount } from "@/lib/auth/account";
import { HurService, toPublicVehicle } from "@/lib/hur_service";

/**
 * Хэрэглэгчийн вэбээс дуудах HUR lookup. Account session-аар auth хийнэ.
 * Өмчлөгчийн PII буцаахгүй (toPublicVehicle).
 * GET /api/account/hur/lookup?plate=1234УБА
 */
export async function GET(req: Request) {
  const account = await getAccount();
  if (!account) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай." }, { status: 401 });
  }

  const limited = enforceRateLimit(
    req,
    "hur-account",
    { limit: 20, windowMs: 60_000 },
    account.id,
  );
  if (limited) return limited;

  const plate = new URL(req.url).searchParams.get("plate")?.trim() ?? "";
  if (!plate) {
    return NextResponse.json(
      { error: "Улсын дугаар шаардлагатай." },
      { status: 400 },
    );
  }

  try {
    const vehicle = toPublicVehicle(await HurService.getVehicle(plate));
    return NextResponse.json({ vehicle });
  } catch (e) {
    const message = e instanceof Error ? e.message : "HUR алдаа гарлаа.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
