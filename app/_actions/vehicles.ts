"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { canCreate, canDelete, canEdit } from "@/lib/auth/roles";
import { assertActiveSubscription } from "@/lib/subscription-server";
import { normalizeWheelPosition } from "@/lib/hur_service";
import { PLAN_LIMIT_CODES } from "@/lib/plan-limits";
import { enforceCountLimit } from "@/lib/plan-limits-server";
import { prisma } from "@/lib/prisma";
import {
  normalizePlate,
  ownerFromCustomer,
  resolveVehicleForOwner,
} from "@/lib/vehicles";

export type VehicleActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

// Машин аль хэдийн ЭНЭ tenant-д бүртгэлтэй болохыг транзакц дотроос дохиоллох.
class VehicleAlreadyInTenant extends Error {}

/**
 * Энэ tenant-д тухайн машинтай холбоотой засварын хуудас/оношилгоо байгаа эсэх.
 * Устгах болон эзэн солихыг хориглох нэг ижил шалгуур.
 */
async function vehicleHasHistory(
  tenantId: string,
  vehicleId: string,
): Promise<boolean> {
  const [orderCount, reportCount] = await Promise.all([
    prisma.serviceOrder.count({ where: { tenantId, vehicleId } }),
    prisma.diagnosticReport.count({ where: { tenantId, vehicleId } }),
  ]);
  return orderCount > 0 || reportCount > 0;
}

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

  const { customerId, isPostpaid, ...attrs } = data;

  // Vehicle = эзэмшигчийн бүртгэл: сонгосон Customer-ийн account/утсаар ижил
  // эзний мөрийг тааруулна; өөр эзний ижил дугаартай мөр байсан ч ШИНЭ мөр
  // үүсгэнэ (машин зарагдсан — түүх өмнөх эзэнд үлдэнэ). Өөр tenant-аас эзэн
  // "импортлох" байхгүй: дугаар эзнийг тодорхойлохгүй.
  const canonPlate = normalizePlate(data.plate);

  // Давхардал: энэ tenant-д ижил дугаартай машин ЯГ энэ Customer-т (эсвэл
  // эзэн сонгоогүй бол эзэнгүй) аль хэдийн бүртгэлтэй бол дахин үүсгэхгүй.
  const duplicate = await prisma.tenantVehicle.findFirst({
    where: {
      tenantId: user.tenantId,
      customerId: customerId ?? null,
      vehicle: { plate: canonPlate },
    },
    select: { id: true },
  });
  if (duplicate) {
    return {
      ok: false,
      fieldErrors: {
        plate: customerId
          ? "Энэ үйлчлүүлэгчид ийм дугаартай машин аль хэдийн бүртгэлтэй байна."
          : "Энэ улсын дугаартай эзэнгүй машин аль хэдийн бүртгэлтэй байна.",
      },
    };
  }

  let vehicleId: string;
  try {
    vehicleId = await prisma.$transaction(async (tx) => {
      const owner = await ownerFromCustomer(tx, user.tenantId, customerId);
      const vehicle = await resolveVehicleForOwner(tx, { ...attrs, owner });
      const existing = await tx.tenantVehicle.findUnique({
        where: {
          tenantId_vehicleId: { tenantId: user.tenantId, vehicleId: vehicle.id },
        },
        select: { id: true, customerId: true },
      });
      if (existing) {
        // Ижил эзний мөр энэ tenant-д ЭЗЭНГҮЙ link-тэй байсан бол эзнийг нь
        // тавьж "өөриймшүүлнэ"; эзэнтэй бол давхардал.
        if (existing.customerId || !customerId) throw new VehicleAlreadyInTenant();
        await tx.tenantVehicle.update({
          where: { id: existing.id },
          data: { customerId, isPostpaid },
        });
        return vehicle.id;
      }
      await tx.tenantVehicle.create({
        data: {
          tenantId: user.tenantId,
          vehicleId: vehicle.id,
          customerId,
          isPostpaid,
        },
      });
      return vehicle.id;
    });
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

  const finalCustomerId = customerId;
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

  // Улсын дугаар бүртгэсний дараа ХӨДӨЛШГҮЙ — form-оос ирсэн plate-г үл тоож
  // (readOnly input хэвээр submit хийгдэнэ) зөвхөн бусад шинжийг шинэчилнэ.
  const { customerId, isPostpaid, plate: _plate, ...attrs } = data;
  void _plate;

  // id = vehicleId. Тенантад бүртгэлтэй (link байгаа) эсэхийг шалгана.
  const link = await prisma.tenantVehicle.findUnique({
    where: { tenantId_vehicleId: { tenantId: user.tenantId, vehicleId: id } },
    select: { id: true, customerId: true },
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

  // Эзэн солих = засварын түүх өөр хүнд шилжих. Энэ tenant-д тухайн машинтай
  // захиалга/оношилгоо байвал зөвшөөрөхгүй — шинэ эзэн бол шинээр бүртгэнэ.
  if ((customerId ?? null) !== link.customerId && (await vehicleHasHistory(user.tenantId, id))) {
    return {
      ok: false,
      fieldErrors: {
        customerId:
          "Засварын түүхтэй машины эзнийг солих боломжгүй — шинэ эзэн бол машиныг шинээр бүртгэнэ.",
      },
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Машины бие даасан шинжийг шинэчилнэ (plate-гүй).
      await tx.vehicle.update({ where: { id }, data: attrs });
      // Харьяалал, дараа төлбөрт төлөвийг зөвхөн энэ tenant-ийн link дээр шинэчилнэ.
      await tx.tenantVehicle.update({
        where: { id: link.id },
        data: { customerId, isPostpaid },
      });
    });
  } catch (e) {
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
  if (await vehicleHasHistory(user.tenantId, id)) {
    throw new Error(
      "Энэ машинтай холбоотой засварын хуудас байгаа тул устгах боломжгүй.",
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
