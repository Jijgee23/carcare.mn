import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/api";
import { getAccount } from "@/lib/auth/account";
import { HurService, toPublicVehicle } from "@/lib/hur_service";
import { prisma } from "@/lib/prisma";
import { normalizePlate, vehicleToLookupInfo } from "@/lib/vehicles";

/**
 * Хэрэглэгчийн вэбээс дуудах машины lookup. Account session-аар auth хийнэ.
 * Эхлээд global Vehicle бүртгэлээс хайж, байхгүй үед л HUR-аас татна.
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

  // Системд аль хэдийн бүртгэлтэй бол HUR дуудалгүй шууд ашиглана. Ижил
  // дугаартай мөр олон байж болно (эзэн тус бүрт) — сүүлд шинэчлэгдсэнийг авна.
  const canonPlate = normalizePlate(plate);
  const existing = await prisma.vehicle.findFirst({
    where: { plate: canonPlate },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) {
    // Хэрэглэгчийн өөрийн гаражид ижил дугаартай машин байвал анхааруулна.
    const link = await prisma.accountVehicle.findFirst({
      where: { accountId: account.id, vehicle: { plate: canonPlate } },
      select: { id: true },
    });
    return NextResponse.json({
      vehicle: vehicleToLookupInfo(existing),
      source: "global",
      registered: Boolean(link),
    });
  }

  try {
    const vehicle = toPublicVehicle(await HurService.getVehicle(canonPlate));
    return NextResponse.json({ vehicle, source: "hur" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "HUR алдаа гарлаа.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
