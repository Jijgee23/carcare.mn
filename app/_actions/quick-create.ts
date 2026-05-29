"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { canCreate } from "@/lib/auth/roles";
import { normalizeWheelPosition } from "@/lib/hur_service";
import { prisma } from "@/lib/prisma";

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
  if (!fullName) errors.fullName = "Овог нэрээ оруулна уу.";
  if (!phone) errors.phone = "Утасны дугаар оруулна уу.";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = "Имэйл хаяг буруу.";
  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

  let created;
  try {
    created = await prisma.customer.create({
      data: { fullName, phone, email, note, tenantId: user.tenantId },
      select: { id: true, fullName: true, phone: true },
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
    entity: "Customer",
    entityId: created.id,
    action: "CREATE",
    summary: `${fullName} (захиалгаас түргэн)`,
    after: { fullName, phone, email, note },
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

  let created;
  try {
    created = await prisma.vehicle.create({
      data: {
        plate,
        vin,
        make,
        model,
        year,
        fuelType,
        wheelPosition,
        customerId,
        tenantId: user.tenantId,
      },
      select: {
        id: true,
        plate: true,
        make: true,
        model: true,
        customerId: true,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        fieldErrors: {
          plate: "Энэ улсын дугаартай машин аль хэдийн бүртгэгдсэн байна.",
        },
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
    entity: "Vehicle",
    entityId: created.id,
    action: "CREATE",
    summary: `${plate} · ${make} ${model} (захиалгаас түргэн)`,
    after: { plate, make, model, year, fuelType, customerId },
  });

  revalidatePath("/dashboard/vehicles");
  if (created.customerId) {
    revalidatePath(`/dashboard/customers/${created.customerId}`);
  }
  return { ok: true, vehicle: created };
}
