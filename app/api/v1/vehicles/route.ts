import { Prisma } from "@/app/generated/prisma/client";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const customerId = url.searchParams.get("customerId")?.trim() ?? "";
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? "50"), 1),
    200,
  );

  const where: Prisma.VehicleWhereInput = { tenantId: auth.user.tenantId };
  if (customerId) where.customerId = customerId;
  if (q) {
    where.OR = [
      { plate: { contains: q, mode: "insensitive" } },
      { make: { contains: q, mode: "insensitive" } },
      { model: { contains: q, mode: "insensitive" } },
      { vin: { contains: q, mode: "insensitive" } },
    ];
  }

  const vehicles = await prisma.vehicle.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      plate: true,
      vin: true,
      make: true,
      model: true,
      year: true,
      mileage: true,
      customerId: true,
      customer: { select: { id: true, fullName: true, phone: true } },
    },
  });

  return jsonOk({ vehicles });
}

export async function POST(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

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

  try {
    const vehicle = await prisma.vehicle.create({
      data: {
        tenantId: auth.user.tenantId,
        plate: plateStr,
        vin: vinStr || null,
        make: makeStr,
        model: modelStr,
        year: yearNum,
        mileage: mileageNum,
        customerId: customerIdStr,
      },
      select: {
        id: true,
        plate: true,
        vin: true,
        make: true,
        model: true,
        year: true,
        mileage: true,
        customerId: true,
      },
    });
    return jsonOk({ vehicle }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return jsonError(422, "Хүсэлт буруу.", {
        fieldErrors: { plate: "Энэ улсын дугаар бүртгэлтэй байна." },
      });
    }
    throw e;
  }
}
