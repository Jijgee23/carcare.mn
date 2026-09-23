"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { canCreate, canDelete, canEdit } from "@/lib/auth/roles";
import { assertActiveSubscription } from "@/lib/subscription-server";
import { type BulkActionState, parseIdsJson } from "@/lib/bulk-action";
import { PLAN_LIMIT_CODES } from "@/lib/plan-limits";
import { enforceCountLimit } from "@/lib/plan-limits-server";
import { prisma } from "@/lib/prisma";
import { SERVICE_KINDS, SERVICE_KIND_SLUG, type ServiceKind } from "@/lib/services";
import {
  ServiceCommandError,
  adjustServiceStockCommand,
  bulkChangeServiceCategoryCommand,
  deleteServiceCommand,
  updateServiceCommand,
} from "@/lib/services/service-commands";

export type ServiceActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function parseDecimal(v: string): Prisma.Decimal | null {
  if (!v) return null;
  const cleaned = v.replace(/[,\s]/g, "");
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return new Prisma.Decimal(cleaned);
}

async function authorize(action: "create" | "edit" | "delete") {
  const user = await requireUser();
  const ok =
    action === "create"
      ? canCreate(user, "services")
      : action === "edit"
        ? canEdit(user, "services")
        : canDelete(user, "services");
  if (!ok) {
    throw new Error("Танд үйлчилгээ/бараанд энэ үйлдэл хийх эрх байхгүй.");
  }
  await assertActiveSubscription(user.tenantId);
  return user;
}

type Parsed = {
  type: ServiceKind;
  name: string;
  code: string | null;
  unitId: string | null;
  price: Prisma.Decimal;
  costPrice: Prisma.Decimal | null;
  stock: Prisma.Decimal | null;
  durationValue: Prisma.Decimal | null;
  durationUnitId: string | null;
  reminderIntervalMonths: number | null;
  description: string | null;
  isActive: boolean;
  categoryId: string | null;
};

async function validate(
  fd: FormData,
  tenantId: string,
): Promise<{
  data: Parsed | null;
  errors: Record<string, string>;
}> {
  const typeRaw = s(fd, "type");
  const name = s(fd, "name");
  const code = s(fd, "code").toUpperCase();
  const unitIdRaw = s(fd, "unitId");
  const priceRaw = s(fd, "price");
  const costRaw = s(fd, "costPrice");
  const stockRaw = s(fd, "stock");
  const durationValueRaw = s(fd, "durationValue");
  const durationUnitIdRaw = s(fd, "durationUnitId");
  const reminderIntervalMonthsRaw = s(fd, "reminderIntervalMonths");
  const description = s(fd, "description");
  const categoryIdRaw = s(fd, "categoryId");
  const isActive = fd.get("isActive") === "on";

  const errors: Record<string, string> = {};

  if (!SERVICE_KINDS.includes(typeRaw as ServiceKind)) {
    errors.type = "Төрлийг сонгоно уу.";
  }
  if (!name) errors.name = "Нэр оруулна уу.";
  const price = parseDecimal(priceRaw);
  if (!price) errors.price = "Үнэ буруу.";

  const type = typeRaw as ServiceKind;

  let costPrice: Prisma.Decimal | null = null;
  let stock: Prisma.Decimal | null = null;
  let durationValue: Prisma.Decimal | null = null;
  let durationUnitId: string | null = null;
  let categoryId: string | null = null;
  let unitId: string | null = null;

  // Хэмжих нэгж: LABOR / GOODS-д заавал
  if (type === "LABOR" || type === "GOODS") {
    if (!unitIdRaw) {
      errors.unitId = "Хэмжих нэгж сонгоно уу.";
    } else {
      const exists = await prisma.unit.findFirst({
        where: { id: unitIdRaw, tenantId },
        select: { id: true },
      });
      if (!exists) errors.unitId = "Сонгосон нэгж олдсонгүй.";
      else unitId = unitIdRaw;
    }
  }

  if (type === "GOODS") {
    if (costRaw) {
      costPrice = parseDecimal(costRaw);
      if (!costPrice) errors.costPrice = "Өртөг үнэ буруу.";
    }
    const initialStock = stockRaw || "0";
    stock = parseDecimal(initialStock);
    if (!stock) errors.stock = "Үлдэгдэл буруу.";
  }

  // Хугацаа (LABOR/DIAGNOSTIC) — заавал биш, гэхдээ хэрэв утга/нэгж нэг нь оруулагдсан бол нөгөө нь ч оруулагдсан байх ёстой
  if (type !== "GOODS") {
    const hasValue = Boolean(durationValueRaw);
    const hasUnit = Boolean(durationUnitIdRaw);
    if (hasValue || hasUnit) {
      if (!hasValue) {
        errors.durationValue = "Хугацааны утгаа оруулна уу.";
      } else {
        const d = parseDecimal(durationValueRaw);
        if (!d || d.lte(0)) errors.durationValue = "Хугацаа эерэг тоо байх ёстой.";
        else durationValue = d;
      }
      if (!hasUnit) {
        errors.durationUnitId = "Хугацааны нэгжээ сонгоно уу.";
      } else {
        const exists = await prisma.unit.findFirst({
          where: { id: durationUnitIdRaw, tenantId },
          select: { id: true },
        });
        if (!exists) errors.durationUnitId = "Сонгосон нэгж олдсонгүй.";
        else durationUnitId = durationUnitIdRaw;
      }
    }
  }

  // Сануулгын давтамж (сар) — заавал биш, дурын төрөлд. Тавьвал энэ
  // үйлчилгээ COMPLETED болсон мөр бүрээс хойш ийм олон сарын дараа
  // үйлчлүүлэгчид push сануулга явна (харах: app/api/cron/service-reminders).
  let reminderIntervalMonths: number | null = null;
  if (reminderIntervalMonthsRaw) {
    const n = Number.parseInt(reminderIntervalMonthsRaw, 10);
    if (!Number.isFinite(n) || n <= 0) {
      errors.reminderIntervalMonths = "Сар эерэг бүхэл тоо байх ёстой.";
    } else {
      reminderIntervalMonths = n;
    }
  }

  // Бүх төрөлд ангилал заавал
  if (!categoryIdRaw) {
    errors.categoryId = "Ангилал сонгоно уу.";
  } else {
    const exists = await prisma.category.findFirst({
      where: { id: categoryIdRaw, tenantId },
      select: { id: true },
    });
    if (!exists) {
      errors.categoryId = "Сонгосон ангилал олдсонгүй.";
    } else {
      categoryId = categoryIdRaw;
    }
  }

  if (Object.keys(errors).length > 0) return { data: null, errors };

  return {
    data: {
      type,
      name,
      code: code || null,
      unitId,
      price: price!,
      costPrice,
      stock,
      durationValue,
      durationUnitId,
      reminderIntervalMonths,
      description: description || null,
      isActive,
      categoryId,
    },
    errors,
  };
}

function redirectAfter(type: ServiceKind): never {
  redirect(`/dashboard/services/${SERVICE_KIND_SLUG[type]}`);
}

export async function createServiceAction(
  _prev: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  let user;
  try {
    user = await authorize("create");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const { data, errors } = await validate(formData, user.tenantId);
  if (!data) return { ok: false, fieldErrors: errors };

  // Багцын хязгаар: max_services
  const limit = await enforceCountLimit(
    user.tenantId,
    PLAN_LIMIT_CODES.MAX_SERVICES,
    () => prisma.service.count({ where: { tenantId: user.tenantId } }),
  );
  if (!limit.allowed) {
    return { ok: false, message: limit.message };
  }

  let created;
  try {
    created = await prisma.service.create({
      data: {
        tenantId: user.tenantId,
        type: data.type,
        name: data.name,
        code: data.code,
        unitId: data.unitId,
        price: data.price,
        costPrice: data.costPrice,
        stock: data.stock,
        durationValue: data.durationValue,
        durationUnitId: data.durationUnitId,
        reminderIntervalMonths: data.reminderIntervalMonths,
        description: data.description,
        isActive: data.isActive,
        categoryId: data.categoryId,
      },
      select: { id: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        fieldErrors: { code: "Энэ код тухайн төрөлд бүртгэгдсэн байна." },
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
    entity: "Service",
    entityId: created.id,
    action: "CREATE",
    summary: `[${data.type}] ${data.name}${data.code ? ` · ${data.code}` : ""}`,
    after: {
      type: data.type,
      name: data.name,
      code: data.code,
      price: data.price.toString(),
      stock: data.stock?.toString() ?? null,
    },
  });

  revalidatePath("/dashboard/services", "layout");
  redirectAfter(data.type);
}

// P4-B1 — thin adapter over `updateServiceCommand`
// (`lib/services/service-commands.ts`). All validation, the type-conditional
// unit/duration/category rules, the stock-is-never-written-here behaviour and
// the P2002 code-conflict mapping now live only in the command module — see
// its doc comment for the whole-record-replace decision this slice made.
export async function updateServiceAction(
  id: string,
  _prev: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  let user;
  try {
    user = await authorize("edit");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  let updated;
  try {
    updated = await updateServiceCommand({
      actor: user,
      serviceId: id,
      data: {
        type: s(formData, "type"),
        name: s(formData, "name"),
        code: s(formData, "code").toUpperCase(),
        unitId: s(formData, "unitId"),
        price: s(formData, "price"),
        costPrice: s(formData, "costPrice"),
        stock: s(formData, "stock"),
        durationValue: s(formData, "durationValue"),
        durationUnitId: s(formData, "durationUnitId"),
        reminderIntervalMonths: s(formData, "reminderIntervalMonths"),
        description: s(formData, "description"),
        isActive: formData.get("isActive") === "on",
        categoryId: s(formData, "categoryId"),
      },
    });
  } catch (e) {
    if (e instanceof ServiceCommandError) {
      if (e.fieldErrors) return { ok: false, fieldErrors: e.fieldErrors };
      return { ok: false, message: e.message };
    }
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Шинэчлэх явцад алдаа гарлаа.",
    };
  }

  revalidatePath("/dashboard/services", "layout");
  revalidatePath(`/dashboard/services/${id}`);
  redirectAfter(updated.type);
}

// P4-B1 — thin adapter over `deleteServiceCommand`. The command decides
// archive-vs-hard-delete; this adapter only swallows the not-found case, same
// as the original inline `if (!svc) return;`.
export async function deleteServiceAction(formData: FormData): Promise<void> {
  const user = await authorize("delete");
  const id = s(formData, "id");
  if (!id) return;

  try {
    await deleteServiceCommand({ actor: user, serviceId: id });
  } catch (e) {
    if (e instanceof ServiceCommandError && e.code === "SERVICE_NOT_FOUND") return;
    throw e;
  }

  revalidatePath("/dashboard/services", "layout");
}

// P4-B1 — thin adapter over `adjustServiceStockCommand`.
export async function adjustServiceStockAction(
  id: string,
  _prev: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  let user;
  try {
    user = await authorize("edit");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  try {
    await adjustServiceStockCommand({
      actor: user,
      serviceId: id,
      data: {
        direction: s(formData, "direction"),
        amount: s(formData, "amount"),
      },
    });
  } catch (e) {
    if (e instanceof ServiceCommandError) {
      if (e.fieldErrors) return { ok: false, fieldErrors: e.fieldErrors };
      return { ok: false, message: e.message };
    }
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Алдаа гарлаа.",
    };
  }

  revalidatePath("/dashboard/services/goods");
  revalidatePath(`/dashboard/services/${id}`);
  return { ok: true, message: "Үлдэгдэл шинэчлэгдлээ." };
}

// Жагсаалтаас олноор сонгож ангилал солих (харах:
// bulkChangeOrderStatusAction/bulkAssignOrderAction app/_actions/orders.ts,
// bulkChangeAppointmentCategoryAction app/_actions/appointments.ts — адил
// all-or-nothing БИШ загвар). Ангилал бүх Service-д заавал тул хоослож
// болохгүй.
//
// P4-B1 — thin adapter over `bulkChangeServiceCategoryCommand`. The three
// whole-request rejections (missing categoryId, unknown categoryId, empty
// selection) surface as plain `{ok:false,message}` — same shape as the
// original inline early-returns, no succeeded/failed/errors keys attached.
export async function bulkChangeServiceCategoryAction(
  _prev: BulkActionState,
  formData: FormData,
): Promise<BulkActionState> {
  let user;
  try {
    user = await authorize("edit");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const categoryId = s(formData, "categoryId");
  const ids = parseIdsJson(s(formData, "serviceIdsJson"));

  let result;
  try {
    result = await bulkChangeServiceCategoryCommand({
      actor: user,
      categoryId,
      serviceIds: ids,
    });
  } catch (e) {
    if (e instanceof ServiceCommandError) return { ok: false, message: e.message };
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Ангилал солиход алдаа гарлаа.",
    };
  }

  revalidatePath("/dashboard/services", "layout");

  const { succeeded, failed, errors } = result;
  if (succeeded === 0) {
    return {
      ok: false,
      message: errors[0] ?? "Ангилал солиход алдаа гарлаа.",
      succeeded,
      failed,
      errors,
    };
  }
  return {
    ok: true,
    message: `${succeeded}/${ids.length} мөрийн ангилал шинэчлэгдлээ.${
      failed ? ` (${failed} амжилтгүй)` : ""
    }`,
    succeeded,
    failed,
    errors: errors.length ? errors : undefined,
  };
}
