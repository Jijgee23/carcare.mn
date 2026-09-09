"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { canCreate } from "@/lib/auth/roles";
import { assertActiveSubscription } from "@/lib/subscription-server";
import { normalizeWheelPosition } from "@/lib/hur_service";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { ensureTenantVehicle, resolveVehicle } from "@/lib/vehicles";

// Захиалга үүсгэх явцад үйлчлүүлэгч / машин шинээр бүртгэх — хуудас сольж redirect
// хийхгүй, шинээр үүсгэсэн бичлэгийг буцаана.

async function authorize(resource: "customers" | "vehicles") {
  const user = await requireUser();
  if (!canCreate(user, resource)) {
    throw new Error(
      resource === "customers"
        ? "Танд үйлчлүүлэгч үүсгэх эрх байхгүй."
        : "Танд машин үүсгэх эрх байхгүй.",
    );
  }
  await assertActiveSubscription(user.tenantId);
  return user;
}

// ---------- Customer ------------------------------------------------------

export type QuickCustomerResult = {
  ok: boolean;
  customer?: { id: string; fullName: string; phone: string };
  fieldErrors?: Record<string, string>;
  message?: string;
};

export async function quickCreateCustomerAction(input: {
  fullName: string;
  phone: string;
  email?: string | null;
  note?: string | null;
}): Promise<QuickCustomerResult> {
  let user;
  try {
    user = await authorize("customers");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const fullName = input.fullName?.trim() ?? "";
  const phone = input.phone?.trim() ?? "";
  const email = input.email?.trim() || null;
  const note = input.note?.trim() || null;

  const errors: Record<string, string> = {};
  // Зөвхөн утас заавал. Овог нэр заавал биш.
  if (!phone) errors.phone = "Утасны дугаар оруулна уу.";
  else if (!isValidPhone(phone))
    errors.phone = "Утасны дугаар 8 оронтой тоо байх ёстой.";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = "Имэйл хаяг буруу.";
  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

  const normalizedPhone = normalizePhone(phone) ?? phone;

  // Утасны дугаараар онлайн Account олж, байвал шинэ Customer-т холбоно —
  // эс бөгөөс энэ Customer "Миний захиалгууд"/"Засварын захиалгууд"-д (харилцагчийн
  // апп/веб) хожим харагдахгүй үлддэг байсан (2026-09-08 хэрэглэгчийн тайлан:
  // ажилтны шууд үүсгэсэн захиалга харилцагчид харагдахгүй байсан — үндэс нь
  // энэ функц accountId-г огт тохируулдаггүй байсан явдал байсан).
  const account = await prisma.account.findUnique({
    where: { phone: normalizedPhone },
    select: { id: true },
  });

  if (account) {
    // Энэ Account-д зориулсан Customer тухайн tenant-д аль хэдийн байвал
    // (@@unique([tenantId, accountId])) шинээр үүсгэхгүй, түүнийг ашиглана.
    const existingForAccount = await prisma.customer.findUnique({
      where: { tenantId_accountId: { tenantId: user.tenantId, accountId: account.id } },
      select: { id: true, fullName: true, phone: true },
    });
    if (existingForAccount) {
      return { ok: true, customer: existingForAccount };
    }
  }

  let created;
  try {
    // Ижил утастай "эзэнгүй" (accountId=null) Customer энэ tenant-д өмнө нь
    // үүссэн байж болзошгүй (энэ засвараас өмнө) — шинээр давхардуулан
    // үүсгэхийн оронд түүнийг "нэхэмжлэх" (accountId-г нь тохируулах).
    const unclaimed = account
      ? await prisma.customer.findFirst({
          where: { tenantId: user.tenantId, phone: normalizedPhone, accountId: null },
          select: { id: true },
        })
      : null;

    created = unclaimed
      ? await prisma.customer.update({
          where: { id: unclaimed.id },
          data: { fullName: fullName || undefined, email, note, accountId: account!.id },
          select: { id: true, fullName: true, phone: true },
        })
      : await prisma.customer.create({
          data: {
            fullName,
            phone: normalizedPhone,
            email,
            note,
            tenantId: user.tenantId,
            accountId: account?.id ?? null,
          },
          select: { id: true, fullName: true, phone: true },
        });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        fieldErrors: { phone: "Энэ утасны дугаартай үйлчлүүлэгч аль хэдийн бүртгэлтэй байна." },
      };
    }
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Үүсгэх явцад алдаа гарлаа.",
    };
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "Customer",
    entityId: created.id,
    action: "CREATE",
    summary: `${fullName || normalizedPhone} (засварын хуудаснаас түргэн)`,
    after: { fullName, phone: normalizedPhone, email, note },
  });

  revalidatePath("/dashboard/customers");
  return { ok: true, customer: created };
}

// ---------- Vehicle -------------------------------------------------------

export type QuickVehicleResult = {
  ok: boolean;
  vehicle?: {
    id: string;
    plate: string;
    make: string;
    model: string;
    customerId: string | null;
    isPostpaid: boolean;
  };
  fieldErrors?: Record<string, string>;
  message?: string;
};

export async function quickCreateVehicleAction(input: {
  plate: string;
  vin: string | null;
  make: string;
  model: string;
  year: number | null;
  fuelType: string | null;
  wheelPosition: string | null;
  customerId: string;
}): Promise<QuickVehicleResult> {
  let user;
  try {
    user = await authorize("vehicles");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const plate = input.plate?.trim().toUpperCase() ?? "";
  const vin = input.vin?.trim().toUpperCase() || null;
  const make = input.make?.trim() ?? "";
  const model = input.model?.trim() ?? "";
  const year = Number.isFinite(input.year) ? input.year : null;
  const fuelType = input.fuelType?.trim() || null;
  const wheelPosition = normalizeWheelPosition(input.wheelPosition ?? null);
  const customerId = input.customerId?.trim() ?? "";

  const errors: Record<string, string> = {};
  if (!plate) errors.plate = "Улсын дугаар оруулна уу.";
  if (!make) errors.make = "Маркаа оруулна уу.";
  if (!model) errors.model = "Моделоо оруулна уу.";
  if (!customerId) errors.customerId = "Үйлчлүүлэгч сонгох эсвэл нэмэх ёстой.";
  if (year !== null && (year < 1900 || year > 2100)) errors.year = "Жил буруу.";
  if (wheelPosition && wheelPosition !== "Зүүн" && wheelPosition !== "Баруун") {
    errors.wheelPosition = "Жолооны хүрдний талыг буруу сонгосон.";
  }
  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

  if (customerId) {
    const c = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!c) return { ok: false, fieldErrors: { customerId: "Үйлчлүүлэгч олдсонгүй." } };
  }

  let created: {
    id: string;
    plate: string;
    make: string;
    model: string;
    customerId: string | null;
    isPostpaid: boolean;
  };
  try {
    created = await prisma.$transaction(async (tx) => {
      const v = await resolveVehicle(tx, {
        plate,
        vin,
        make,
        model,
        year,
        fuelType,
        wheelPosition,
      });
      await ensureTenantVehicle(tx, {
        tenantId: user.tenantId,
        vehicleId: v.id,
        customerId,
      });
      const full = await tx.vehicle.findUniqueOrThrow({
        where: { id: v.id },
        select: { id: true, plate: true, make: true, model: true },
      });
      // Машин өмнө нь бүртгэлтэй байсан бол link-ийн одоогийн төлөвийг авна.
      const link = await tx.tenantVehicle.findUnique({
        where: {
          tenantId_vehicleId: { tenantId: user.tenantId, vehicleId: v.id },
        },
        select: { isPostpaid: true },
      });
      return { ...full, customerId, isPostpaid: link?.isPostpaid ?? false };
    });
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Үүсгэх явцад алдаа гарлаа.",
    };
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "Vehicle",
    entityId: created.id,
    action: "CREATE",
    summary: `${plate} · ${make} ${model} (засварын хуудаснаас түргэн)`,
    after: { plate, make, model, year, fuelType, customerId },
  });

  revalidatePath("/dashboard/vehicles");
  if (created.customerId) {
    revalidatePath(`/dashboard/customers/${created.customerId}`);
  }
  return { ok: true, vehicle: created };
}
