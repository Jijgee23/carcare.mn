import { Prisma } from "@/app/generated/prisma/client";
import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { requireActiveSubscriptionApi } from "@/lib/subscription-server";
import { buildMeta, getApiPageInfo } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { resolveVehicle } from "@/lib/vehicles";

export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const customerId = url.searchParams.get("customerId")?.trim() ?? "";
  const { page, pageSize, skip, take } = getApiPageInfo(url.searchParams);

  const where: Prisma.TenantVehicleWhereInput = { tenantId: auth.user.tenantId };
  if (customerId) where.customerId = customerId;
  if (q) {
    where.vehicle = {
      OR: [
        { plate: { contains: q, mode: "insensitive" } },
        { make: { contains: q, mode: "insensitive" } },
        { model: { contains: q, mode: "insensitive" } },
        { vin: { contains: q, mode: "insensitive" } },
      ],
    };
  }

  const [links, total] = await Promise.all([
    prisma.tenantVehicle.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        customerId: true,
        customer: { select: { id: true, fullName: true, phone: true } },
        vehicle: {
          select: {
            id: true,
            plate: true,
            vin: true,
            make: true,
            model: true,
            year: true,
            mileage: true,
          },
        },
      },
    }),
    prisma.tenantVehicle.count({ where }),
  ]);

  const vehicles = links.map((l) => ({
    ...l.vehicle,
    customerId: l.customerId,
    customer: l.customer,
  }));

  return jsonOk({ vehicles, pagination: buildMeta(total, page, pageSize) });
}

export async function POST(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "vehicles.create");
  if (denied) return denied;
  const locked = await requireActiveSubscriptionApi(auth.user);
  if (locked) return locked;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.");
  }
  if (!body || typeof body !== "object") return jsonError(400, "Body буруу.");

  const { plate, vin, make, model, year, mileage, customerId } = body as Record<
    string,
    unknown
  >;

  const plateStr = typeof plate === "string" ? plate.trim().toUpperCase() : "";
  const makeStr = typeof make === "string" ? make.trim() : "";
  const modelStr = typeof model === "string" ? model.trim() : "";
  const vinStr = typeof vin === "string" ? vin.trim() : "";
  const yearNum =
    typeof year === "number"
      ? Math.floor(year)
      : typeof year === "string" && year.trim()
        ? Math.floor(Number(year))
        : null;
  const mileageNum =
    typeof mileage === "number"
      ? Math.floor(mileage)
      : typeof mileage === "string" && mileage.trim()
        ? Math.floor(Number(mileage))
        : null;
  const customerIdStr =
    typeof customerId === "string" && customerId.trim() ? customerId.trim() : null;

  const fieldErrors: Record<string, string> = {};
  if (!plateStr) fieldErrors.plate = "Улсын дугаар шаардлагатай.";
  if (!makeStr) fieldErrors.make = "Үйлдвэрлэгч шаардлагатай.";
  if (!modelStr) fieldErrors.model = "Загвар шаардлагатай.";
  if (yearNum !== null && (Number.isNaN(yearNum) || yearNum < 1900))
    fieldErrors.year = "Он буруу.";
  if (mileageNum !== null && (Number.isNaN(mileageNum) || mileageNum < 0))
    fieldErrors.mileage = "Гүйлт буруу.";
  if (Object.keys(fieldErrors).length > 0) {
    return jsonError(422, "Хүсэлт буруу.", { fieldErrors });
  }

  if (customerIdStr) {
    const cust = await prisma.customer.findFirst({
      where: { id: customerIdStr, tenantId: auth.user.tenantId },
      select: { id: true },
    });
    if (!cust)
      return jsonError(422, "Хүсэлт буруу.", {
        fieldErrors: { customerId: "Үйлчлүүлэгч олдсонгүй." },
      });
  }

  const vehicle = await prisma.$transaction(async (tx) => {
    const v = await resolveVehicle(tx, {
      plate: plateStr,
      vin: vinStr || null,
      make: makeStr,
      model: modelStr,
      year: yearNum,
      mileage: mileageNum,
    });
    await tx.tenantVehicle.upsert({
      where: {
        tenantId_vehicleId: {
          tenantId: auth.user.tenantId,
          vehicleId: v.id,
        },
      },
      create: {
        tenantId: auth.user.tenantId,
        vehicleId: v.id,
        customerId: customerIdStr,
      },
      update: customerIdStr ? { customerId: customerIdStr } : {},
    });
    return tx.vehicle.findUniqueOrThrow({
      where: { id: v.id },
      select: {
        id: true,
        plate: true,
        vin: true,
        make: true,
        model: true,
        year: true,
        mileage: true,
      },
    });
  });
  return jsonOk(
    { vehicle: { ...vehicle, customerId: customerIdStr } },
    { status: 201 },
  );
}
