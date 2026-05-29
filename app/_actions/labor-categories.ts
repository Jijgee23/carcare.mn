"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type LaborCategoryActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

async function authorizeOwner() {
  const user = await requireUser();
  if (!user.isOwner) {
    throw new Error("Зөвхөн админ ажлын ангилал удирдана.");
  }
  return user;
}

function validate(fd: FormData): {
  data: { name: string; description: string | null; isActive: boolean } | null;
  errors: Record<string, string>;
} {
  const name = s(fd, "name");
  const description = s(fd, "description");
  const isActive = fd.get("isActive") === "on";
  const errors: Record<string, string> = {};

  if (!name) errors.name = "Ангилалын нэрээ оруулна уу.";
  else if (name.length > 60) errors.name = "Нэр 60 тэмдэгтээс хэтрэхгүй.";

  if (description && description.length > 200)
    errors.description = "Тайлбар 200 тэмдэгтээс хэтрэхгүй.";

  if (Object.keys(errors).length > 0) return { data: null, errors };

  return {
    data: { name, description: description || null, isActive },
    errors,
  };
}

export async function createLaborCategoryAction(
  _prev: LaborCategoryActionState,
  formData: FormData,
): Promise<LaborCategoryActionState> {
  let user;
  try {
    user = await authorizeOwner();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const { data, errors } = validate(formData);
  if (!data) return { ok: false, fieldErrors: errors };

  let created;
  try {
    created = await prisma.laborCategory.create({
      data: {
        tenantId: user.tenantId,
        name: data.name,
        description: data.description,
        isActive: data.isActive,
      },
      select: { id: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        fieldErrors: { name: "Энэ нэртэй ангилал бүртгэгдсэн байна." },
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
    entity: "LaborCategory",
    entityId: created.id,
    action: "CREATE",
    summary: data.name,
    after: data,
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/services", "layout");
  return { ok: true, message: "Ангилал нэмэгдлээ." };
}

export async function updateLaborCategoryAction(
  id: string,
  _prev: LaborCategoryActionState,
  formData: FormData,
): Promise<LaborCategoryActionState> {
  let user;
  try {
    user = await authorizeOwner();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const { data, errors } = validate(formData);
  if (!data) return { ok: false, fieldErrors: errors };

  try {
    const updated = await prisma.laborCategory.updateMany({
      where: { id, tenantId: user.tenantId },
      data: {
        name: data.name,
        description: data.description,
        isActive: data.isActive,
      },
    });
    if (updated.count === 0) return { ok: false, message: "Ангилал олдсонгүй." };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        fieldErrors: { name: "Энэ нэртэй ангилал бүртгэгдсэн байна." },
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
    entity: "LaborCategory",
    entityId: id,
    action: "UPDATE",
    summary: data.name,
    after: data,
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/services", "layout");
  return { ok: true, message: "Хадгалагдлаа." };
}

export async function deleteLaborCategoryAction(formData: FormData): Promise<void> {
  const user = await authorizeOwner();
  const id = s(formData, "id");
  if (!id) return;

  const target = await prisma.laborCategory.findFirst({
    where: { id, tenantId: user.tenantId },
    select: { name: true },
  });

  const usedCount = await prisma.service.count({
    where: { tenantId: user.tenantId, laborCategoryId: id },
  });

  if (usedCount > 0) {
    await prisma.laborCategory.updateMany({
      where: { id, tenantId: user.tenantId },
      data: { isActive: false },
    });
  } else {
    await prisma.laborCategory.deleteMany({
      where: { id, tenantId: user.tenantId },
    });
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "LaborCategory",
    entityId: id,
    action: usedCount > 0 ? "UPDATE" : "DELETE",
    summary: target ? `${target.name}${usedCount > 0 ? " (архивлав)" : ""}` : null,
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/services", "layout");
}
