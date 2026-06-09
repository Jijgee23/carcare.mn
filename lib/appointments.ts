import { Prisma, type PrismaClient } from "@/app/generated/prisma/client";
import { normalizePhone } from "@/lib/phone";

export const APPOINTMENT_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "REJECTED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDING: "Хүлээгдэж буй",
  CONFIRMED: "Баталгаажсан",
  REJECTED: "Татгалзсан",
  CANCELLED: "Цуцлагдсан",
  NO_SHOW: "Ирээгүй",
};

export const APPOINTMENT_STATUS_BADGE: Record<AppointmentStatus, string> = {
  PENDING: "bg-amber-500/15 text-amber-400 border border-amber-500/25",
  CONFIRMED: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
  REJECTED: "bg-red-500/10 text-red-400 border border-red-500/20",
  CANCELLED: "bg-zinc-500/15 text-zinc-300 border border-zinc-500/25",
  NO_SHOW: "bg-purple-500/15 text-purple-300 border border-purple-500/25",
};

// Ажилтны хийж болох төлвийн шилжилт.
export const APPOINTMENT_STATUS_TRANSITIONS: Record<
  AppointmentStatus,
  AppointmentStatus[]
> = {
  PENDING: ["CONFIRMED", "REJECTED"],
  CONFIRMED: ["NO_SHOW", "CANCELLED"],
  REJECTED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

type Client = PrismaClient | Prisma.TransactionClient;

/**
 * Гүүр — global Account-ийг тенантын дотоод Customer-той утсаар нь холбоно.
 *
 *  1) Аль хэдийн холбогдсон Customer байвал түүнийг буцаана.
 *  2) Эс бөгөөс утсаар тааруулж (холбогдоогүй Customer) олвол холбож буцаана.
 *  3) Олдохгүй бол шинэ Customer үүсгэнэ.
 *
 * $transaction client дамжуулж дуудах нь зөв — Customer resolve + appointment
 * шинэчлэлт нэг атомт үйлдэл болно.
 */
export async function resolveCustomerForAccount(
  client: Client,
  tenantId: string,
  account: {
    id: string;
    phone: string;
    name: string | null;
    email: string | null;
  },
): Promise<string> {
  // 1) Аль хэдийн холбогдсон
  const linked = await client.customer.findUnique({
    where: { tenantId_accountId: { tenantId, accountId: account.id } },
    select: { id: true },
  });
  if (linked) return linked.id;

  const phone = normalizePhone(account.phone) ?? account.phone;

  // 2) Утсаар тааруулж холбоно (холбогдоогүй Customer). Хадгалагдсан дугаар нь
  // өөр форматтай (ж: +976...) байж болзошгүй тул endsWith-ээр ч шалгана.
  const candidate = await client.customer.findFirst({
    where: {
      tenantId,
      accountId: null,
      OR: [{ phone }, { phone: { endsWith: phone } }],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (candidate) {
    await client.customer.update({
      where: { id: candidate.id },
      data: { accountId: account.id },
    });
    return candidate.id;
  }

  // 3) Шинээр үүсгэнэ
  const created = await client.customer.create({
    data: {
      tenantId,
      accountId: account.id,
      fullName: account.name?.trim() || "Цаг захиалсан хэрэглэгч",
      phone,
      email: account.email,
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Хэрэглэгчийн global AccountVehicle-ийг тенантын Vehicle руу snapshot хийнэ.
 *  - [tenantId, plate]-аар тааруулж, байвал тэр Vehicle-ийг (эзэнгүй бол
 *    customer-т холбож) буцаана.
 *  - Үгүй бол тухайн customer-т шинэ Vehicle үүсгэнэ.
 */
export async function snapshotVehicleForAccount(
  client: Client,
  tenantId: string,
  customerId: string,
  v: {
    plate: string;
    make: string;
    model: string;
    year: number | null;
    vin: string | null;
    fuelType: string | null;
    wheelPosition: string | null;
    mileage: number | null;
  },
): Promise<string> {
  const plate = v.plate.trim();

  const existing = await client.vehicle.findUnique({
    where: { tenantId_plate: { tenantId, plate } },
    select: { id: true, customerId: true },
  });
  if (existing) {
    if (!existing.customerId) {
      await client.vehicle.update({
        where: { id: existing.id },
        data: { customerId },
      });
    }
    return existing.id;
  }

  const created = await client.vehicle.create({
    data: {
      tenantId,
      customerId,
      plate,
      make: v.make,
      model: v.model,
      year: v.year,
      vin: v.vin,
      fuelType: v.fuelType,
      wheelPosition: v.wheelPosition,
      mileage: v.mileage,
    },
    select: { id: true },
  });
  return created.id;
}
