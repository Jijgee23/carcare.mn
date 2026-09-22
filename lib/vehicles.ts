import type { Prisma } from "@/app/generated/prisma/client";
import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import type { PrismaTransactionClient } from "@/lib/prisma";

type Client = PrismaTransactionClient;

/**
 * Утсаар тааруулах нөхцөл — DB-д хадгалагдсан дугаар өөр форматтай (+976…)
 * байж болзошгүй тул яг тэнцүү ЭСВЭЛ төгсгөл тохирохыг хоёуланг нь шалгана
 * (lib/appointments.ts resolveCustomerForAccount-тай ижил зарчим).
 * Хоосон/хүчингүй утас → null (endsWith:"" бүхэнд таарах тул ХЭЗЭЭ Ч үүсгэхгүй).
 */
function phoneMatch(phone: string | null | undefined): Prisma.StringFilter[] | null {
  const canon = normalizePhone(phone);
  if (!canon) return null;
  return [{ equals: canon }, { endsWith: canon }];
}

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
    where: { OR: customerOwnershipFilters(accountId, phone) },
    select: { vehicleId: true },
    distinct: ["vehicleId"],
  });
  return links.map((l) => l.vehicleId);
}

/**
 * "Энэ Customer энэ account-ийнх" гэх OR нөхцөлүүд — `customer` relation-тай
 * дурын модель (TenantVehicle, ServiceOrder, DiagnosticReport, Appointment)
 * дээр ашиглана. Засварын түүх зөвхөн эзэнд харагдах дүрэм: захиалга/тайлан
 * нь account-той холбоотой (accountId эсвэл утас) Customer-ийнх байх ёстой.
 * Ингэснээр хуучин (миграцаар салгаагүй) олон эзэнтэй Vehicle мөр дээр ч өөр
 * эзний захиалга харагдахгүй.
 */
export function customerOwnershipFilters(
  accountId: string,
  phone: string | null | undefined,
): { customer: Prisma.CustomerWhereInput }[] {
  const or: { customer: Prisma.CustomerWhereInput }[] = [
    { customer: { accountId } },
  ];
  const pm = phoneMatch(phone);
  if (pm) or.push(...pm.map((phone) => ({ customer: { phone } })));
  return or;
}

// Vehicle-д бичигдэх машины бие даасан/тогтмол шинж (харьяалал биш).
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
 * кирилл болгоно. Ижил эзний мөрийг тааруулах, HUR prefill хайх гол түлхүүр
 * тул бүх бүртгэл/хайлт үүгээр нормчлогдох ёстой.
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
// дарж бичихгүй); mileage-г илүү ихээр шинэчилнэ. plate-г ХӨНДӨХГҮЙ.
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

/**
 * Машины эзэмшигч — Vehicle мөрийг "хэнийх" гэж тааруулах түлхүүрүүд.
 *  - tenantId + customerId: ажилтан tenant-ийнхаа Customer-т бүртгэж байна.
 *  - accountId / phone: хэрэглэгчийн app account, эсвэл Customer-ийн
 *    account холбоос/утас (cross-tenant ижил эзнийг таних).
 */
export type VehicleOwner = {
  tenantId?: string | null;
  customerId?: string | null;
  accountId?: string | null;
  phone?: string | null;
};

/**
 * Эзэмшигчийн дугаараар нь бүртгэлтэй Vehicle мөрийг тааруулах WHERE.
 * Тохирох дараалал (аль нэг нь таарвал хангалттай):
 *  1. Энэ tenant-д яг энэ Customer-т link-тэй.
 *  2. accountId: AccountVehicle эсвэл Customer.accountId тэнцүү.
 *  3. Утас: Account.phone / Customer.phone тохирох — гэхдээ ЗӨВХӨН account
 *     холбоосгүй талд (хоёулаа accountId-тай байгаад зөрвөл өөр хүн).
 * Хоосон/null утгаар нөхцөл ХЭЗЭЭ Ч үүсгэхгүй (`accountId: null` бүх walk-in-д,
 * `endsWith: ""` бүхэнд таарна).
 * Энэ tenant-д ӨӨР (null биш) Customer-т link-тэй мөрийг хасна — тэр мөр өөр
 * эзний бүртгэл; түүн рүү холбовол захиалгын форм "машин сонгосон
 * үйлчлүүлэгчийнх биш" гэж мухардана.
 */
function ownerMatchWhere(
  plate: string,
  owner: VehicleOwner,
): Prisma.VehicleWhereInput | null {
  const or: Prisma.VehicleWhereInput[] = [];
  const tenantId = owner.tenantId || null;
  const customerId = owner.customerId || null;
  const accountId = owner.accountId || null;
  const pm = phoneMatch(owner.phone);

  if (tenantId && customerId) {
    or.push({ tenantLinks: { some: { tenantId, customerId } } });
  }
  if (accountId) {
    or.push({ accountLinks: { some: { accountId } } });
    or.push({ tenantLinks: { some: { customer: { accountId } } } });
  }
  if (pm) {
    for (const phone of pm) {
      // Account-той эзэн: account холбоосгүй Customer-ийг л утсаар тааруулна;
      // account холбоотой Customer-ийг accountId-аар дээр шалгасан.
      or.push({
        tenantLinks: {
          some: {
            customer: accountId ? { phone, accountId: null } : { phone },
          },
        },
      });
      // Account-гүй эзэн (tenant Customer): утас нь тохирсон Account-ийн
      // өөрөө нэмсэн машин. Account-той бол accountId-аар аль хэдийн шалгасан.
      if (!accountId) {
        or.push({ accountLinks: { some: { account: { phone } } } });
      }
    }
  }
  if (or.length === 0) return null;

  const where: Prisma.VehicleWhereInput = { plate, OR: or };
  if (tenantId) {
    where.NOT = {
      tenantLinks: {
        some: {
          tenantId,
          customerId: { not: null },
          ...(customerId ? { NOT: { customerId } } : {}),
        },
      },
    };
  }
  return where;
}

/**
 * Эзэмшигчийн Vehicle мөрийг олж эсвэл шинээр үүсгэнэ.
 *
 *  - Ижил дугаартай, ИЖИЛ эзэнд (ownerMatchWhere) бүртгэлтэй мөр байвал түүнийг
 *    буцааж хоосон талбарыг баяжуулна (plate хөндөхгүй).
 *  - Олдохгүй, эсвэл `owner` байхгүй (эзэнгүй бүртгэл) бол ШИНЭ мөр үүсгэнэ —
 *    ижил дугаартай өөр эзний мөр байсан ч хамаагүй (машин зарагдсан гэж үзнэ;
 *    түүх өмнөх мөрөнд үлдэнэ).
 *
 * Транзакц client дамжуулж дуудах нь зөв — TenantVehicle/AccountVehicle link-тэй
 * нэг атомт үйлдэл болгоно.
 */
export async function resolveVehicleForOwner(
  client: Client,
  input: { plate: string; owner: VehicleOwner | null } & VehicleAttrs,
): Promise<{ id: string; created: boolean }> {
  const plate = normalizePlate(input.plate);
  const vin = normalizeVin(input.vin);
  const attrs = input;

  const where = input.owner ? ownerMatchWhere(plate, input.owner) : null;
  const existing = where
    ? await client.vehicle.findFirst({
        where,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          vin: true,
          year: true,
          fuelType: true,
          wheelPosition: true,
          colorName: true,
          capacity: true,
          purpose: true,
          ownerRegnum: true,
          mileage: true,
        },
      })
    : null;

  if (existing) {
    await client.vehicle.update({
      where: { id: existing.id },
      data: enrichData(existing, vin, attrs),
    });
    return { id: existing.id, created: false };
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
  return { id: created.id, created: true };
}

/**
 * Tenant Customer-ийн эзэмшигч түлхүүрүүдийг уншина (resolveVehicleForOwner-д
 * дамжуулахад). Customer энэ tenant-д байхгүй бол null.
 */
export async function ownerFromCustomer(
  client: Client,
  tenantId: string,
  customerId: string | null | undefined,
): Promise<VehicleOwner | null> {
  if (!customerId) return null;
  const c = await client.customer.findFirst({
    where: { id: customerId, tenantId },
    select: { id: true, accountId: true, phone: true },
  });
  if (!c) return null;
  return { tenantId, customerId: c.id, accountId: c.accountId, phone: c.phone };
}

/**
 * Tenant ↔ Vehicle link-ийг олж/үүсгэнэ. customerId-г ЗӨВХӨН link-д эзэн
 * байхгүй үед тавина — байгаа эзнийг дарж бичихгүй (эзэн солигдвол засварын
 * түүх шинэ хүнд шилжих ёсгүй; шинэ эзэнд шинэ Vehicle мөр бүртгэнэ).
 * Буцаах `customerId` = link-ийн БОДИТ эзэн (дамжуулснаас өөр байж болно).
 */
export async function ensureTenantVehicle(
  client: Client,
  input: { tenantId: string; vehicleId: string; customerId?: string | null },
): Promise<{ id: string; customerId: string | null }> {
  const { tenantId, vehicleId } = input;
  const customerId = input.customerId ?? null;
  const link = await client.tenantVehicle.upsert({
    where: { tenantId_vehicleId: { tenantId, vehicleId } },
    create: { tenantId, vehicleId, customerId },
    update: {},
    select: { id: true, customerId: true },
  });
  if (customerId && !link.customerId) {
    await client.tenantVehicle.update({
      where: { id: link.id },
      data: { customerId },
    });
    return { id: link.id, customerId };
  }
  return link;
}
