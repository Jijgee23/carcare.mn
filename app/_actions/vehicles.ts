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
import { normalizePlate, normalizeVin, resolveVehicle } from "@/lib/vehicles";

export type VehicleActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

// Машин аль хэдийн ЭНЭ tenant-д бүртгэлтэй болохыг транзакц дотроос дохиоллох.
class VehicleAlreadyInTenant extends Error {}

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
    colorName: string | null;
    capacity: number | null;
    purpose: string | null;
    ownerRegnum: string | null;
    customerId: string | null;
    isPostpaid: boolean;
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
  const colorName = s(fd, "colorName");
  const capacityStr = s(fd, "capacity");
  const purpose = s(fd, "purpose");
  const ownerRegnum = s(fd, "ownerRegnum");
  const customerId = s(fd, "customerId");
  const isPostpaid = fd.get("isPostpaid") === "on";

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

  let capacity: number | null = null;
  if (capacityStr) {
    const n = Number.parseInt(capacityStr.replace(/\s+/g, ""), 10);
    if (!Number.isFinite(n) || n < 0) {
      errors.capacity = "Моторын хэмжээ буруу.";
    } else {
      capacity = n;
    }
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
      colorName: colorName || null,
      capacity,
      purpose: purpose || null,
      ownerRegnum: ownerRegnum || null,
      customerId: customerId || null,
      isPostpaid,
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

  // Багцын хязгаар: max_vehicles (тенантад бүртгэлтэй машины тоо = TenantVehicle)
  const limit = await enforceCountLimit(
    user.tenantId,
    PLAN_LIMIT_CODES.MAX_VEHICLES,
    () => prisma.tenantVehicle.count({ where: { tenantId: user.tenantId } }),
  );
  if (!limit.allowed) {
    return { ok: false, message: limit.message };
  }

  const { customerId: selectedCustomerId, isPostpaid, ...attrs } = data;

  // Эзэн сонгоогүй бөгөөд машин өөр tenant-д эзэнтэй бүртгэлтэй бол эзнийг нь
  // хамт авчирна: энэ tenant-д утас/account-аар нь байвал холбоно, үгүй бол
  // (план хязгаар зөвшөөрвөл) шинээр үүсгэнэ.
  let customerId = selectedCustomerId;
  let importOwner: {
    fullName: string;
    phone: string;
    email: string | null;
    accountId: string | null;
  } | null = null;
  if (!customerId) {
    const vin = normalizeVin(data.vin);
    const existingVehicle =
      (vin
        ? await prisma.vehicle.findUnique({ where: { vin }, select: { id: true } })
        : null) ??
      (await prisma.vehicle.findUnique({
        where: { plate: normalizePlate(data.plate) },
        select: { id: true },
      }));
    if (existingVehicle) {
      const otherLink = await prisma.tenantVehicle.findFirst({
        where: {
          vehicleId: existingVehicle.id,
          tenantId: { not: user.tenantId },
          customerId: { not: null },
        },
        orderBy: { updatedAt: "desc" },
        select: {
          customer: {
            select: { fullName: true, phone: true, email: true, accountId: true },
          },
        },
      });
      const src = otherLink?.customer;
      if (src) {
        const dup = await prisma.customer.findFirst({
          where: {
            tenantId: user.tenantId,
            OR: [
              { phone: src.phone },
              ...(src.accountId ? [{ accountId: src.accountId }] : []),
            ],
          },
          select: { id: true },
        });
        if (dup) {
          customerId = dup.id;
        } else {
          const custLimit = await enforceCountLimit(
            user.tenantId,
            PLAN_LIMIT_CODES.MAX_CUSTOMERS,
            () => prisma.customer.count({ where: { tenantId: user.tenantId } }),
          );
          if (custLimit.allowed) importOwner = src;
        }
      }
    }
  }

  let vehicleId: string;
  let importedCustomerId: string | null = null;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const vehicle = await resolveVehicle(tx, attrs);
      const existing = await tx.tenantVehicle.findUnique({
        where: {
          tenantId_vehicleId: { tenantId: user.tenantId, vehicleId: vehicle.id },
        },
        select: { id: true },
      });
      if (existing) throw new VehicleAlreadyInTenant();
      let linkCustomerId = customerId;
      let createdCustomerId: string | null = null;
      if (!linkCustomerId && importOwner) {
        const created = await tx.customer.create({
          data: {
            tenantId: user.tenantId,
            fullName: importOwner.fullName,
            phone: importOwner.phone,
            email: importOwner.email,
            accountId: importOwner.accountId,
          },
          select: { id: true },
        });
        linkCustomerId = created.id;
        createdCustomerId = created.id;
      }
      await tx.tenantVehicle.create({
        data: {
          tenantId: user.tenantId,
          vehicleId: vehicle.id,
          customerId: linkCustomerId,
          isPostpaid,
        },
      });
      return { vehicleId: vehicle.id, createdCustomerId };
    });
    vehicleId = result.vehicleId;
    importedCustomerId = result.createdCustomerId;
  } catch (e) {
    if (e instanceof VehicleAlreadyInTenant) {
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
    entityId: vehicleId,
    action: "CREATE",
    summary: `${data.plate} · ${data.make} ${data.model}`,
    after: data,
  });

  // Өөр tenant-аас эзнийг нь хамт авчирсан бол audit-д бүртгэнэ.
  if (importedCustomerId && importOwner) {
    await logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      entity: "Customer",
      entityId: importedCustomerId,
      action: "CREATE",
      summary: `${importOwner.fullName || importOwner.phone} · машины эзнээр автоматаар үүссэн (${data.plate})`,
      after: { fullName: importOwner.fullName, phone: importOwner.phone },
    });
  }

  const finalCustomerId = customerId ?? importedCustomerId;
  revalidatePath("/dashboard/vehicles");
  revalidatePath("/dashboard/customers");
  if (finalCustomerId) {
    revalidatePath(`/dashboard/customers/${finalCustomerId}`);
  }
  redirect(
    finalCustomerId
      ? `/dashboard/customers/${finalCustomerId}`
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

  const { customerId, isPostpaid, ...attrs } = data;

  // id = global vehicleId. Тенантад бүртгэлтэй (link байгаа) эсэхийг шалгана.
  const link = await prisma.tenantVehicle.findUnique({
    where: { tenantId_vehicleId: { tenantId: user.tenantId, vehicleId: id } },
    select: { id: true },
  });
  if (!link) return { ok: false, message: "Машин олдсонгүй." };

  if (customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!customer) {
      return { ok: false, fieldErrors: { customerId: "Үйлчлүүлэгч олдсонгүй." } };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Global Vehicle-ийн бие даасан шинжийг шинэчилнэ (бүх tenant-д нийтлэг).
      await tx.vehicle.update({ where: { id }, data: attrs });
      // Харьяалал, дараа төлбөрт төлөвийг зөвхөн энэ tenant-ийн link дээр шинэчилнэ.
      await tx.tenantVehicle.update({
        where: { id: link.id },
        data: { customerId, isPostpaid },
      });
    });
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

  // id = global vehicleId. Устгах нь зөвхөн ЭНЭ tenant-ийн link-ийг хасна —
  // global Vehicle болон бусад tenant-ийн түүх хадгалагдана.
  const target = await prisma.vehicle.findUnique({
    where: { id },
    select: { plate: true, make: true, model: true },
  });

  // Энэ tenant-д тус машинтай холбоотой захиалга/оношилгоо байвал хасахгүй.
  const [orderCount, reportCount] = await Promise.all([
    prisma.serviceOrder.count({
      where: { tenantId: user.tenantId, vehicleId: id },
    }),
    prisma.diagnosticReport.count({
      where: { tenantId: user.tenantId, vehicleId: id },
    }),
  ]);
  if (orderCount > 0 || reportCount > 0) {
    throw new Error(
      "Энэ машинтай холбоотой захиалга байгаа тул устгах боломжгүй.",
    );
  }

  const removed = await prisma.tenantVehicle.deleteMany({
    where: { tenantId: user.tenantId, vehicleId: id },
  });
  if (removed.count === 0) return;

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
