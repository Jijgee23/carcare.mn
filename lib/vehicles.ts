import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { PrismaTransactionClient } from "@/lib/prisma";

type Client = PrismaTransactionClient;

/**
 * Account-ийн БАТАЛГААЖСАН эзэмшлийн машины ID-үүд (cross-tenant) —
 * үйлчилгээ/оношилгооны түүх бүтээхэд ашиглана. `AccountVehicle` өөрөө
 * claim хийдэг тул эзэмшлийн нотолгоо БОЛОХГҮЙ (харах: prisma/schema.prisma
 * AccountVehicle) — зөвхөн TenantVehicle дэх Customer.accountId холбоос
 * эсвэл утасны тохирлыг эзэмшил гэж үзнэ.
 */
export async function ownedVehicleIdsForAccount(
  accountId: string,
  phone: string,
): Promise<string[]> {
  const links = await prisma.tenantVehicle.findMany({
    where: {
      OR: [
        { customer: { accountId } },
        { customer: { phone: { endsWith: phone } } },
      ],
    },
    select: { vehicleId: true },
    distinct: ["vehicleId"],
  });
  return links.map((l) => l.vehicleId);
}

// Global Vehicle-д бичигдэх машины бие даасан/тогтмол шинж (харьяалал биш).
export type VehicleAttrs = {
  make: string;
  model: string;
  year?: number | null;
  vin?: string | null;
  fuelType?: string | null;
  wheelPosition?: string | null;
  colorName?: string | null;
  capacity?: number | null;
  purpose?: string | null;
  ownerRegnum?: string | null;
  mileage?: number | null;
};

// Латин ↔ кирилл нүдэнд ижил харагдах үсгүүд. Монгол дугаарын үсэг кирилл тул
// латин хувилбарыг кирилл рүү хөрвүүлж канон болгоно — "1234ABC" (латин) болон
// "1234АВС" (кирилл) нэг л машин.
const PLATE_LATIN_TO_CYRILLIC: Record<string, string> = {
  A: "А", B: "В", C: "С", E: "Е", H: "Н", K: "К",
  M: "М", O: "О", P: "Р", T: "Т", X: "Х", Y: "У",
};

/**
 * Улсын дугаарын канон формат: том үсэг, зай/тэмдэгтгүй, латин төстэй үсгийг
 * кирилл болгоно. Global Vehicle-ийн давхардлыг таслах гол түлхүүр тул бүх
 * бүртгэл/хайлт үүгээр нормчлогдох ёстой.
 */
export function normalizePlate(p: string): string {
  return p
    .toUpperCase()
    .replace(/[^0-9A-ZА-ЯЁӨҮ]/g, "")
    .replace(/[ABCEHKMOPTXY]/g, (ch) => PLATE_LATIN_TO_CYRILLIC[ch] ?? ch);
}

/**
 * Global Vehicle бичлэгийг HUR lookup-ийн хариутай ижил (PublicHurVehicle)
 * хэлбэрт хөрвүүлнэ. Шинэ машин бүртгэхэд дугаараар нь системд аль хэдийн
 * бүртгэлтэй бол HUR дуудалгүйгээр талбаруудыг үүгээр бөглөнө.
 */
export function vehicleToLookupInfo(v: {
  plate: string;
  make: string;
  model: string;
  year: number | null;
  vin: string | null;
  fuelType: string | null;
  wheelPosition: string | null;
  colorName: string | null;
  capacity: number | null;
  purpose: string | null;
}) {
  return {
    plate: v.plate,
    make: v.make,
    model: v.model,
    year: v.year,
    vin: v.vin,
    color: v.colorName,
    country: null,
    fuelType: v.fuelType,
    capacity: v.capacity,
    className: null,
    importDate: null,
    wheelPosition: v.wheelPosition,
    purpose: v.purpose,
  };
}

export function normalizeVin(v: string | null | undefined): string | null {
  const t = (v ?? "").trim().toUpperCase();
  return t || null;
}

// Олдсон машины хоосон талбарыг шинэ мэдээллээр баяжуулна (байгаа утгыг
// дарж бичихгүй); plate-г одоогийн утга руу, mileage-г илүү ихээр шинэчилнэ.
function enrichData(
  existing: {
    vin: string | null;
    year: number | null;
    fuelType: string | null;
    wheelPosition: string | null;
    colorName: string | null;
    capacity: number | null;
    purpose: string | null;
    ownerRegnum: string | null;
    mileage: number | null;
  },
  plate: string,
  vin: string | null,
  attrs: VehicleAttrs,
): Prisma.VehicleUpdateInput {
  const pick = <T>(cur: T | null, next: T | null | undefined): T | null =>
    cur ?? next ?? null;
  const mileage =
    attrs.mileage != null
      ? Math.max(existing.mileage ?? 0, attrs.mileage)
      : existing.mileage;
  return {
    plate,
    vin: existing.vin ?? vin,
    year: pick(existing.year, attrs.year),
    fuelType: pick(existing.fuelType, attrs.fuelType),
    wheelPosition: pick(existing.wheelPosition, attrs.wheelPosition),
    colorName: pick(existing.colorName, attrs.colorName),
    capacity: pick(existing.capacity, attrs.capacity),
    purpose: pick(existing.purpose, attrs.purpose),
    ownerRegnum: pick(existing.ownerRegnum, attrs.ownerRegnum),
    mileage,
  };
}

/** Дугаар солигдохоос өмнөх утгыг VehiclePlateHistory-д бичнэ. */
async function recordPlateChange(
  client: Client,
  vehicleId: string,
  oldPlate: string,
): Promise<void> {
  await client.vehiclePlateHistory.create({
    data: { vehicleId, plate: oldPlate },
  });
}

/**
 * Global Vehicle-ийг VIN (тэргүүлэх) эсвэл plate-ээр олж/үүсгэнэ.
 *
 *  - VIN байвал эхлээд VIN-ээр хайна (жинхэнэ identity).
 *  - Эс бөгөөс plate-ээр хайна.
 *  - Plate нь өөр VIN-тэй машинд бүртгэлтэй бол (дугаар шилжсэн) хуучин машинаас
 *    plate-ийг чөлөөлж (tombstone), шинэ машин үүсгэнэ.
 *  - Олдсон бол хоосон талбарыг баяжуулна.
 *
 * Транзакц client дамжуулж дуудах нь зөв — TenantVehicle link-тэй нэг атомт
 * үйлдэл болгоно.
 */
export async function resolveVehicle(
  client: Client,
  input: { plate: string } & VehicleAttrs,
): Promise<{ id: string }> {
  const plate = normalizePlate(input.plate);
  const vin = normalizeVin(input.vin);
  const attrs = input;

  const fullSelect = {
    id: true,
    plate: true,
    vin: true,
    year: true,
    fuelType: true,
    wheelPosition: true,
    colorName: true,
    capacity: true,
    purpose: true,
    ownerRegnum: true,
    mileage: true,
  } as const;

  // 1) VIN-ээр
  let existing = vin
    ? await client.vehicle.findUnique({ where: { vin }, select: fullSelect })
    : null;

  // 2) Plate-ээр
  if (!existing) {
    const byPlate = await client.vehicle.findUnique({
      where: { plate },
      select: fullSelect,
    });
    if (byPlate) {
      if (vin && byPlate.vin && byPlate.vin !== vin) {
        // Дугаар өөр машинд шилжсэн — хуучин эзнээс plate-ийг чөлөөлнө.
        // Тэмдэглэхээс өмнө хуучин дугаарыг нь түүхэнд хадгална.
        await recordPlateChange(client, byPlate.id, byPlate.plate);
        await client.vehicle.update({
          where: { id: byPlate.id },
          data: { plate: `${plate}#OLD-${byPlate.id.slice(-6)}` },
        });
      } else {
        existing = byPlate;
      }
    }
  }

  if (existing) {
    if (existing.plate !== plate) {
      // VIN-ээр олдсон ч дугаар өөр — тухайн машины дугаар шинэчлэгдэж байна.
      await recordPlateChange(client, existing.id, existing.plate);
    }
    await client.vehicle.update({
      where: { id: existing.id },
      data: enrichData(existing, plate, vin, attrs),
    });
    return { id: existing.id };
  }

  const created = await client.vehicle.create({
    data: {
      plate,
      vin,
      make: attrs.make,
      model: attrs.model,
      year: attrs.year ?? null,
      fuelType: attrs.fuelType ?? null,
      wheelPosition: attrs.wheelPosition ?? null,
      colorName: attrs.colorName ?? null,
      capacity: attrs.capacity ?? null,
      purpose: attrs.purpose ?? null,
      ownerRegnum: attrs.ownerRegnum ?? null,
      mileage: attrs.mileage ?? null,
    },
    select: { id: true },
  });
  return { id: created.id };
}

/**
 * Tenant ↔ Vehicle link-ийг олж/үүсгэнэ. customerId өгөгдсөн бол шинэчилнэ
 * (харьяалал tenant бүрт өөр).
 */
export async function ensureTenantVehicle(
  client: Client,
  input: { tenantId: string; vehicleId: string; customerId?: string | null },
): Promise<{ id: string }> {
  const { tenantId, vehicleId } = input;
  const customerId = input.customerId ?? null;
  return client.tenantVehicle.upsert({
    where: { tenantId_vehicleId: { tenantId, vehicleId } },
    create: { tenantId, vehicleId, customerId },
    update: customerId ? { customerId } : {},
    select: { id: true },
  });
}

/**
 * Global Vehicle resolve + tenant link-ийг нэг дор. Захиалга/оношилгоо/цаг
 * захиалга баталгаажуулах урсгалд тохиромжтой. Транзакц дотор дуудна.
 */
export async function upsertTenantVehicle(
  client: Client,
  input: { tenantId: string; customerId?: string | null; plate: string } & VehicleAttrs,
): Promise<{ vehicleId: string; linkId: string }> {
  const vehicle = await resolveVehicle(client, input);
  const link = await ensureTenantVehicle(client, {
    tenantId: input.tenantId,
    vehicleId: vehicle.id,
    customerId: input.customerId,
  });
  return { vehicleId: vehicle.id, linkId: link.id };
}
