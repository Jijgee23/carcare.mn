"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { canCreate, canDelete, canEdit } from "@/lib/auth/roles";
import { assertActiveSubscription } from "@/lib/subscription-server";
import { normalizeWheelPosition } from "@/lib/hur_service";
import { PLAN_LIMIT_CODES } from "@/lib/plan-limits";
import { enforceCountLimit } from "@/lib/plan-limits-server";
import { prisma } from "@/lib/prisma";

export type VehicleActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

async function authorize(action: "create" | "edit" | "delete") {
  const user = await requireUser();
  const ok =
    action === "create"
      ? canCreate(user, "vehicles")
      : action === "edit"
        ? canEdit(user, "vehicles")
        : canDelete(user, "vehicles");
  if (!ok) {
    throw new Error("Танд машинд энэ үйлдэл хийх эрх байхгүй.");
  }
  await assertActiveSubscription(user.tenantId);
  return user;
}

function validate(fd: FormData): {
  data: {
    plate: string;
    vin: string | null;
    make: string;
    model: string;
    year: number | null;
    mileage: number | null;
    fuelType: string | null;
    wheelPosition: string | null;
    customerId: string | null;
  };
  errors: Record<string, string>;
} {
  const plate = s(fd, "plate").toUpperCase();
  const vin = s(fd, "vin").toUpperCase();
  const make = s(fd, "make");
  const model = s(fd, "model");
  const yearStr = s(fd, "year");
  const mileageStr = s(fd, "mileage");
  const fuelType = s(fd, "fuelType");
  const wheelPosition = normalizeWheelPosition(s(fd, "wheelPosition")) ?? "";
  const customerId = s(fd, "customerId");

  const errors: Record<string, string> = {};
  if (!plate) errors.plate = "Улсын дугаар оруулна уу.";
  if (!make) errors.make = "Маркаа оруулна уу.";
  if (!model) errors.model = "Моделоо оруулна уу.";

  let year: number | null = null;
  if (yearStr) {
    const n = Number.parseInt(yearStr, 10);
    if (!Number.isFinite(n) || n < 1900 || n > 2100) {
      errors.year = "Жил буруу.";
    } else {
      year = n;
    }
  }

  let mileage: number | null = null;
  if (mileageStr) {
    const n = Number.parseInt(mileageStr.replace(/\s+/g, ""), 10);
    if (!Number.isFinite(n) || n < 0) {
      errors.mileage = "Гүйлт буруу.";
    } else {
      mileage = n;
    }
  }

  if (wheelPosition && wheelPosition !== "Зүүн" && wheelPosition !== "Баруун") {
    errors.wheelPosition = "Жолооны хүрдний талыг буруу сонгосон.";
  }

  return {
    data: {
      plate,
      vin: vin || null,
      make,
      model,
      year,
      mileage,
      fuelType: fuelType || null,
      wheelPosition: wheelPosition || null,
      customerId: customerId || null,
    },
    errors,
  };
}

// --- CREATE ---------------------------------------------------------------

export async function createVehicleAction(
  _prev: VehicleActionState,
  formData: FormData,
): Promise<VehicleActionState> {
  let user;
  try {
    user = await authorize("create");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const { data, errors } = validate(formData);
  if (Object.keys(errors).length > 0) {
    return { ok: false, fieldErrors: errors };
  }

  if (data.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!customer) {
      return { ok: false, fieldErrors: { customerId: "Үйлчлүүлэгч олдсонгүй." } };
    }
  }

  // Багцын хязгаар: max_vehicles
  const limit = await enforceCountLimit(
    user.tenantId,
    PLAN_LIMIT_CODES.MAX_VEHICLES,
    () => prisma.vehicle.count({ where: { tenantId: user.tenantId } }),
  );
  if (!limit.allowed) {
    return { ok: false, message: limit.message };
  }

  let created;
  try {
    created = await prisma.vehicle.create({
      data: { ...data, tenantId: user.tenantId },
      select: { id: true },
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
    summary: `${data.plate} · ${data.make} ${data.model}`,
    after: data,
  });

  revalidatePath("/dashboard/vehicles");
  revalidatePath("/dashboard/customers");
  if (data.customerId) {
    revalidatePath(`/dashboard/customers/${data.customerId}`);
  }
  redirect(
    data.customerId
      ? `/dashboard/customers/${data.customerId}`
      : "/dashboard/vehicles",
  );
}

// --- UPDATE ---------------------------------------------------------------

export async function updateVehicleAction(
  id: string,
  _prev: VehicleActionState,
  formData: FormData,
): Promise<VehicleActionState> {
  let user;
  try {
    user = await authorize("edit");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const { data, errors } = validate(formData);
  if (Object.keys(errors).length > 0) {
    return { ok: false, fieldErrors: errors };
  }

  if (data.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!customer) {
      return { ok: false, fieldErrors: { customerId: "Үйлчлүүлэгч олдсонгүй." } };
    }
  }

  try {
    const updated = await prisma.vehicle.updateMany({
      where: { id, tenantId: user.tenantId },
      data,
    });
    if (updated.count === 0) {
      return { ok: false, message: "Машин олдсонгүй." };
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        fieldErrors: {
          plate: "Энэ улсын дугаартай өөр машин аль хэдийн бүртгэгдсэн байна.",
        },
      };
    }
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Шинэчлэх явцад алдаа гарлаа.",
    };
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "Vehicle",
    entityId: id,
    action: "UPDATE",
    summary: `${data.plate} · ${data.make} ${data.model}`,
    after: data,
  });

  revalidatePath("/dashboard/vehicles");
  revalidatePath(`/dashboard/vehicles/${id}`);
  revalidatePath("/dashboard/customers");
  if (data.customerId) {
    revalidatePath(`/dashboard/customers/${data.customerId}`);
  }
  redirect("/dashboard/vehicles");
}

// --- DELETE ---------------------------------------------------------------

export async function deleteVehicleAction(formData: FormData): Promise<void> {
  const user = await authorize("delete");
  const id = s(formData, "id");
  if (!id) return;

  const target = await prisma.vehicle.findFirst({
    where: { id, tenantId: user.tenantId },
    select: { plate: true, make: true, model: true },
  });

  try {
    await prisma.vehicle.delete({
      where: { id, tenantId: user.tenantId },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      throw new Error(
        "Энэ машинтай холбоотой захиалга байгаа тул устгах боломжгүй.",
      );
    }
    throw e;
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "Vehicle",
    entityId: id,
    action: "DELETE",
    summary: target ? `${target.plate} · ${target.make} ${target.model}` : null,
  });

  revalidatePath("/dashboard/vehicles");
  revalidatePath("/dashboard/customers");
}
