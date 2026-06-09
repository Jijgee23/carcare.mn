import { Prisma } from "@/app/generated/prisma/client";
import { jsonError, jsonOk } from "@/lib/api";
import { getApiAccountFromRequest } from "@/lib/auth/account-api-token";
import { prisma } from "@/lib/prisma";

// GET /api/v1/app/vehicles — миний машинууд (auth).
export async function GET(req: Request) {
  const account = await getApiAccountFromRequest(req);
  if (!account) return jsonError(401, "Нэвтрэх шаардлагатай.");

  const vehicles = await prisma.accountVehicle.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      plate: true,
      make: true,
      model: true,
      year: true,
      vin: true,
    },
  });
  return jsonOk({ vehicles });
}

// POST /api/v1/app/vehicles — машин нэмэх (auth). { plate, make, model, year?, vin? }
export async function POST(req: Request) {
  const account = await getApiAccountFromRequest(req);
  if (!account) return jsonError(401, "Нэвтрэх шаардлагатай.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.");
  }
  const b = body as {
    plate?: unknown;
    make?: unknown;
    model?: unknown;
    year?: unknown;
    vin?: unknown;
    fuelType?: unknown;
    wheelPosition?: unknown;
  };
  const plate = typeof b.plate === "string" ? b.plate.trim() : "";
  const make = typeof b.make === "string" ? b.make.trim() : "";
  const model = typeof b.model === "string" ? b.model.trim() : "";
  const vin = typeof b.vin === "string" ? b.vin.trim() : "";
  const fuelType = typeof b.fuelType === "string" ? b.fuelType.trim() : "";
  const wheelPosition =
    typeof b.wheelPosition === "string" ? b.wheelPosition.trim() : "";
  if (!plate || !make || !model) {
    return jsonError(400, "plate, make, model шаардлагатай.");
  }
  let year: number | null = null;
  if (b.year != null && b.year !== "") {
    const n = Number.parseInt(String(b.year), 10);
    if (!Number.isFinite(n) || n < 1950 || n > 2100) {
      return jsonError(400, "year буруу.");
    }
    year = n;
  }

  try {
    const vehicle = await prisma.accountVehicle.create({
      data: {
        accountId: account.id,
        plate,
        make,
        model,
        year,
        vin: vin || null,
        fuelType: fuelType || null,
        wheelPosition: wheelPosition || null,
      },
      select: { id: true, plate: true, make: true, model: true, year: true },
    });
    return jsonOk({ vehicle }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return jsonError(409, "Энэ дугаар аль хэдийн бүртгэгдсэн.");
    }
    return jsonError(500, "Машин нэмэхэд алдаа гарлаа.");
  }
}
