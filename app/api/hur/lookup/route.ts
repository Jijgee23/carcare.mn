import { NextResponse } from "next/server";
import { enforceRateLimit, upstreamErrorResponse } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { HurService } from "@/lib/hur_service";
import { findTenantCustomerIdByPhone, toLookupOwner } from "@/lib/hur-lookup";
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
    // PII: бүтэн утас/регистр browser-д гарахгүй (QA #17) — маскалсан утас +
    // харьяаллын төрөл л гарна. Бүртгэх үйлдлийг сервер action өөрөө дахин шийднэ.
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
      ? await findTenantCustomerIdByPhone(session.tenantId, ownerLink.customer.phone)
      : null;
    return NextResponse.json({
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
      ? await findTenantCustomerIdByPhone(session.tenantId, rawOwner.phone)
      : null;
    return NextResponse.json({
      vehicle: { ...rest, owner: rawOwner ? toLookupOwner(rawOwner) : null },
      source: "hur",
      matchedCustomerId,
    });
  } catch (e) {
    return upstreamErrorResponse("hur-lookup", e, "HUR алдаа гарлаа.");
  }
}
