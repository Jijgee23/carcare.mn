"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { canCreate, canDelete, canEdit } from "@/lib/auth/roles";
import { assertActiveSubscription } from "@/lib/subscription-server";
import { PLAN_LIMIT_CODES } from "@/lib/plan-limits";
import { enforceCountLimit } from "@/lib/plan-limits-server";
import { prisma } from "@/lib/prisma";
import { SERVICE_KINDS, SERVICE_KIND_SLUG, type ServiceKind } from "@/lib/services";

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
  description: string | null;
  isActive: boolean;
  laborCategoryId: string | null;
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
  const description = s(fd, "description");
  const laborCategoryIdRaw = s(fd, "laborCategoryId");
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
  let laborCategoryId: string | null = null;
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

  // Ажил төрөлд ажлын ангилал заавал
  if (type === "LABOR") {
    if (!laborCategoryIdRaw) {
      errors.laborCategoryId = "Ажлын ангилал сонгоно уу.";
    } else {
      const exists = await prisma.laborCategory.findFirst({
        where: { id: laborCategoryIdRaw, tenantId },
        select: { id: true },
      });
      if (!exists) {
        errors.laborCategoryId = "Сонгосон ангилал олдсонгүй.";
      } else {
        laborCategoryId = laborCategoryIdRaw;
      }
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
      description: description || null,
      isActive,
      laborCategoryId,
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
        description: data.description,
        isActive: data.isActive,
        laborCategoryId: data.laborCategoryId,
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

  const { data, errors } = await validate(formData, user.tenantId);
  if (!data) return { ok: false, fieldErrors: errors };

  // Засах үед stock-ийг шууд бүү дарж бичиж бай — adjust action ашиглана.
  // updateMany нь relation connect/disconnect-ыг дэмждэггүй болохоор
  // scalar foreign key-уудыг шууд хэрэглэнэ.
  const update: Prisma.ServiceUncheckedUpdateManyInput = {
    name: data.name,
    code: data.code,
    price: data.price,
    costPrice: data.costPrice,
    durationValue: data.durationValue,
    description: data.description,
    isActive: data.isActive,
    unitId: data.unitId,
    durationUnitId: data.durationUnitId,
    laborCategoryId: data.laborCategoryId,
  };

  try {
    const updated = await prisma.service.updateMany({
      where: { id, tenantId: user.tenantId },
      data: update,
    });
    if (updated.count === 0) return { ok: false, message: "Олдсонгүй." };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        fieldErrors: { code: "Энэ код өөр үйлчилгээнд ашиглагдсан байна." },
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
    entity: "Service",
    entityId: id,
    action: "UPDATE",
    summary: `[${data.type}] ${data.name}${data.code ? ` · ${data.code}` : ""}`,
    after: {
      name: data.name,
      code: data.code,
      price: data.price.toString(),
      isActive: data.isActive,
    },
  });

  revalidatePath("/dashboard/services", "layout");
  revalidatePath(`/dashboard/services/${id}`);
  redirectAfter(data.type);
}

export async function deleteServiceAction(formData: FormData): Promise<void> {
  const user = await authorize("delete");
  const id = s(formData, "id");
  if (!id) return;

  const svc = await prisma.service.findFirst({
    where: { id, tenantId: user.tenantId },
    select: { name: true, type: true, _count: { select: { items: true } } },
  });
  if (!svc) return;

  const archived = svc._count.items > 0;
  if (archived) {
    // Захиалгад ашиглагдсан бол идэвхгүй болгоно
    await prisma.service.update({
      where: { id },
      data: { isActive: false },
    });
  } else {
    await prisma.service.delete({ where: { id } });
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "Service",
    entityId: id,
    action: archived ? "UPDATE" : "DELETE",
    summary: `[${svc.type}] ${svc.name}${archived ? " (архивлав)" : ""}`,
  });

  revalidatePath("/dashboard/services", "layout");
}

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

  const direction = s(formData, "direction");
  const amountRaw = s(formData, "amount");
  const errors: Record<string, string> = {};

  const amount = parseDecimal(amountRaw);
  if (!amount || amount.lte(0)) errors.amount = "Эерэг тоо оруулна уу.";
  if (direction !== "in" && direction !== "out")
    errors.direction = "Чиглэлийг сонгоно уу.";

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

  const svc = await prisma.service.findFirst({
    where: { id, tenantId: user.tenantId, type: "GOODS" },
    select: { id: true, stock: true },
  });
  if (!svc) return { ok: false, message: "Бараа олдсонгүй." };

  const current = svc.stock ?? new Prisma.Decimal(0);
  const delta = direction === "in" ? amount! : amount!.negated();
  const next = current.plus(delta);

  if (next.lt(0)) {
    return {
      ok: false,
      fieldErrors: {
        amount: `Үлдэгдэл сөрөг болж байна. Одоо: ${current.toString()}`,
      },
    };
  }

  await prisma.service.update({
    where: { id: svc.id },
    data: { stock: next },
  });

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "Service",
    entityId: svc.id,
    action: "STOCK_CHANGE",
    summary: `${direction === "in" ? "+" : "−"}${amount!.toString()} (гар тохируулга)`,
    before: { stock: current.toString() },
    after: { stock: next.toString(), reason: "MANUAL_ADJUST" },
  });

  revalidatePath("/dashboard/services/goods");
  revalidatePath(`/dashboard/services/${id}`);
  return { ok: true, message: "Үлдэгдэл шинэчлэгдлээ." };
}
