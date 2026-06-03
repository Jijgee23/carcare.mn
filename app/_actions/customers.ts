"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { canCreate, canDelete, canEdit } from "@/lib/auth/roles";
import { PLAN_LIMIT_CODES } from "@/lib/plan-limits";
import { enforceCountLimit } from "@/lib/plan-limits-server";
import { prisma } from "@/lib/prisma";

export type CustomerActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

async function authorize(action: "create" | "edit" | "delete") {
  const user = await requireUser();
  const ok =
    action === "create"
      ? canCreate(user, "customers")
      : action === "edit"
        ? canEdit(user, "customers")
        : canDelete(user, "customers");
  if (!ok) {
    throw new Error("Танд үйлчлүүлэгчид энэ үйлдэл хийх эрх байхгүй.");
  }
  return user;
}

function validate(fd: FormData) {
  const fullName = s(fd, "fullName");
  const phone = s(fd, "phone");
  const email = s(fd, "email");
  const note = s(fd, "note");
  const errors: Record<string, string> = {};

  // Зөвхөн утас заавал. Овог нэр заавал биш — хоосон бол "" хадгална.
  if (!phone) errors.phone = "Утасны дугаар оруулна уу.";
  if (email && !isEmail(email)) errors.email = "Имэйл хаяг буруу.";

  return {
    data: {
      fullName,
      phone,
      email: email || null,
      note: note || null,
    },
    errors,
  };
}

export async function createCustomerAction(
  _prev: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
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

  // Багцын хязгаар: max_customers
  const limit = await enforceCountLimit(
    user.tenantId,
    PLAN_LIMIT_CODES.MAX_CUSTOMERS,
    () => prisma.customer.count({ where: { tenantId: user.tenantId } }),
  );
  if (!limit.allowed) {
    return { ok: false, message: limit.message };
  }

  let created;
  try {
    created = await prisma.customer.create({
      data: { ...data, tenantId: user.tenantId },
      select: { id: true },
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
    summary: data.fullName || data.phone,
    after: data,
  });

  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");
  redirect(`/dashboard/customers/${created.id}`);
}

export async function updateCustomerAction(
  id: string,
  _prev: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
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

  try {
    const updated = await prisma.customer.updateMany({
      where: { id, tenantId: user.tenantId },
      data,
    });
    if (updated.count === 0) {
      return { ok: false, message: "Үйлчлүүлэгч олдсонгүй." };
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Шинэчлэх явцад алдаа гарлаа.",
    };
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "Customer",
    entityId: id,
    action: "UPDATE",
    summary: data.fullName || data.phone,
    after: data,
  });

  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${id}`);
  redirect("/dashboard/customers");
}

export async function deleteCustomerAction(formData: FormData): Promise<void> {
  const user = await authorize("delete");
  const id = s(formData, "id");
  if (!id) return;

  const target = await prisma.customer.findFirst({
    where: { id, tenantId: user.tenantId },
    select: { fullName: true },
  });

  try {
    await prisma.customer.delete({
      where: { id, tenantId: user.tenantId },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      throw new Error(
        "Энэ үйлчлүүлэгчтэй холбоотой захиалга байгаа тул устгах боломжгүй.",
      );
    }
    throw e;
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "Customer",
    entityId: id,
    action: "DELETE",
    summary: target?.fullName,
  });

  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");
}
