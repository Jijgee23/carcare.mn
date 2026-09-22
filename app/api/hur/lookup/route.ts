import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { HurService } from "@/lib/hur_service";
import { prisma } from "@/lib/prisma";
import { normalizePlate, vehicleToLookupInfo } from "@/lib/vehicles";

/**
 * Dashboard-аас дуудах машины lookup. Session-аар auth хийнэ.
 * Эхлээд global Vehicle бүртгэлээс хайж, байхгүй үед л HUR-аас татна.
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

  // Системд аль хэдийн бүртгэлтэй бол HUR дуудалгүй шууд ашиглана. Ижил
  // дугаартай мөр олон байж болно (эзэн тус бүрт) — техник шинж ижил тул
  // хамгийн сүүлд шинэчлэгдсэнийг авна.
  const canonPlate = normalizePlate(plate);
  const existing = await prisma.vehicle.findFirst({
    where: { plate: canonPlate },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) {
    // Энэ tenant-д ижил дугаартай бүртгэл байвал form дээр МЭДЭЭЛНЭ (хаахгүй —
    // өөр эзэн бол шинээр бүртгэх нь зөв). Эзний мэдээлэл зөвхөн ӨӨРИЙН
    // tenant-ийн холбоосоос: өөр tenant-ийн үйлчлүүлэгчийн PII задруулахгүй.
    const ownerLink = await prisma.tenantVehicle.findFirst({
      where: { tenantId: session.tenantId, vehicle: { plate: canonPlate } },
      orderBy: { updatedAt: "desc" },
      select: { customer: { select: { fullName: true, phone: true } } },
    });
    const owner = ownerLink?.customer
      ? {
          firstName: ownerLink.customer.fullName || null,
          lastName: null,
          phone: ownerLink.customer.phone,
          regnum: existing.ownerRegnum,
          type: null,
          address: null,
        }
      : null;
    return NextResponse.json({
      vehicle: { ...vehicleToLookupInfo(existing), owner },
      source: "global",
      registered: Boolean(ownerLink),
    });
  }

  try {
    const vehicle = await HurService.getVehicle(canonPlate);
    return NextResponse.json({ vehicle, source: "hur" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "HUR алдаа гарлаа.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
