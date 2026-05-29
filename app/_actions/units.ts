"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SYSTEM_UNIT_NAMES } from "@/lib/units";

export type UnitActionState = {
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
    throw new Error("Зөвхөн админ нэгж удирдана.");
  }
  return user;
}

function validate(fd: FormData): {
  data: { name: string; code: string | null; isActive: boolean } | null;
  errors: Record<string, string>;
} {
  const name = s(fd, "name");
  const code = s(fd, "code");
  const isActive = fd.get("isActive") === "on";
  const errors: Record<string, string> = {};

  if (!name) errors.name = "Нэгжийн нэрээ оруулна уу.";
  else if (name.length > 30) errors.name = "Нэр 30 тэмдэгтээс хэтэрсэн.";

  if (code && code.length > 10) errors.code = "Богино тэмдэглэгээ 10 тэмдэгтээс хэтрэхгүй.";

  if (Object.keys(errors).length > 0) return { data: null, errors };

  return {
    data: { name, code: code || null, isActive },
    errors,
  };
}

export async function createUnitAction(
  _prev: UnitActionState,
  formData: FormData,
): Promise<UnitActionState> {
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
    created = await prisma.unit.create({
      data: {
        tenantId: user.tenantId,
        name: data.name,
        code: data.code,
        isActive: data.isActive,
      },
      select: { id: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        fieldErrors: { name: "Энэ нэртэй нэгж аль хэдийн бүртгэгдсэн байна." },
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
    entity: "Unit",
    entityId: created.id,
    action: "CREATE",
    summary: `${data.name}${data.code ? ` (${data.code})` : ""}`,
    after: data,
  });

  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Нэгж нэмэгдлээ." };
}

export async function updateUnitAction(
  id: string,
  _prev: UnitActionState,
  formData: FormData,
): Promise<UnitActionState> {
  let user;
  try {
    user = await authorizeOwner();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const { data, errors } = validate(formData);
  if (!data) return { ok: false, fieldErrors: errors };

  const current = await prisma.unit.findFirst({
    where: { id, tenantId: user.tenantId },
    select: { name: true },
  });
  if (!current) return { ok: false, message: "Нэгж олдсонгүй." };

  // Системийн нэгжийн нэр өөрчлөх боломжгүй; идэвхтэй төлвийг үргэлж true байлгана
  const isSystem = SYSTEM_UNIT_NAMES.has(current.name);
  if (isSystem && data.name !== current.name) {
    return {
      ok: false,
      fieldErrors: { name: "Системийн нэгжийн нэрийг өөрчилж болохгүй." },
    };
  }

  try {
    const updated = await prisma.unit.updateMany({
      where: { id, tenantId: user.tenantId },
      data: {
        name: data.name,
        code: data.code,
        isActive: isSystem ? true : data.isActive,
      },
    });
    if (updated.count === 0) return { ok: false, message: "Нэгж олдсонгүй." };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        fieldErrors: { name: "Энэ нэртэй нэгж аль хэдийн бүртгэгдсэн байна." },
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
    entity: "Unit",
    entityId: id,
    action: "UPDATE",
    summary: `${data.name}${data.code ? ` (${data.code})` : ""}`,
    after: data,
  });

  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Хадгалагдлаа." };
}

export async function deleteUnitAction(formData: FormData): Promise<void> {
  const user = await authorizeOwner();
  const id = s(formData, "id");
  if (!id) return;

  const target = await prisma.unit.findFirst({
    where: { id, tenantId: user.tenantId },
    select: { name: true },
  });
  if (!target) return;

  if (SYSTEM_UNIT_NAMES.has(target.name)) {
    throw new Error("Системийн default нэгжийг устгах боломжгүй.");
  }

  await prisma.unit.deleteMany({
    where: { id, tenantId: user.tenantId },
  });

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "Unit",
    entityId: id,
    action: "DELETE",
    summary: target.name,
  });

  revalidatePath("/dashboard/settings");
}
