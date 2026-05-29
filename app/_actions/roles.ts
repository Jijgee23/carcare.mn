"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { isValidPermissionCode } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export type RoleActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function getCheckedPermissions(fd: FormData): string[] {
  const all = fd.getAll("permissions");
  const out: string[] = [];
  for (const v of all) {
    if (typeof v === "string" && isValidPermissionCode(v) && !out.includes(v)) {
      out.push(v);
    }
  }
  return out;
}

async function authorize() {
  const user = await requireUser();
  // Зөвхөн тенант админ (OWNER) Role-ийн жагсаалтыг удирдана. Бусдад өөрсдийн
  // permission байсан ч энэ нь маш чухал учир OWNER-аар хязгаарлав.
  if (!user.isOwner) {
    throw new Error("Зөвхөн тенант админ үүргийг удирдана.");
  }
  return user;
}

type Validated = {
  name: string;
  description: string | null;
  permissions: string[];
  isActive: boolean;
};

function validate(fd: FormData): {
  data: Validated;
  errors: Record<string, string>;
} {
  const name = s(fd, "name");
  const description = s(fd, "description");
  const isActive = fd.get("isActive") !== "off";
  const permissions = getCheckedPermissions(fd);

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Үүргийн нэрээ оруулна уу.";
  if (name.length > 60) errors.name = "Нэр 60 тэмдэгтээс хэтрэхгүй.";
  if (permissions.length === 0) {
    errors.permissions = "Хамгийн багадаа нэг эрх сонгоно уу.";
  }

  return {
    data: {
      name,
      description: description || null,
      permissions,
      isActive,
    },
    errors,
  };
}

// --- CREATE ---------------------------------------------------------------

export async function createRoleAction(
  _prev: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  let user;
  try {
    user = await authorize();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const { data, errors } = validate(formData);
  if (Object.keys(errors).length > 0) {
    return { ok: false, fieldErrors: errors };
  }

  let created;
  try {
    created = await prisma.role.create({
      data: {
        tenantId: user.tenantId,
        name: data.name,
        description: data.description,
        permissions: data.permissions,
        isActive: data.isActive,
      },
      select: { id: true, name: true },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return {
        ok: false,
        fieldErrors: { name: "Энэ нэртэй үүрэг аль хэдийн байна." },
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
    entity: "Role",
    entityId: created.id,
    action: "CREATE",
    summary: `${data.name} · ${data.permissions.length} эрх`,
    after: { name: data.name, permissions: data.permissions, isActive: data.isActive },
  });

  revalidatePath("/dashboard/employees/roles");
  revalidatePath("/dashboard/employees");
  redirect("/dashboard/employees/roles");
}

// --- UPDATE ---------------------------------------------------------------

export async function updateRoleAction(
  id: string,
  _prev: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  let user;
  try {
    user = await authorize();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const { data, errors } = validate(formData);
  if (Object.keys(errors).length > 0) {
    return { ok: false, fieldErrors: errors };
  }

  const target = await prisma.role.findFirst({
    where: { id, tenantId: user.tenantId },
  });
  if (!target) return { ok: false, message: "Үүрэг олдсонгүй." };

  try {
    await prisma.role.update({
      where: { id: target.id },
      data: {
        name: data.name,
        description: data.description,
        permissions: data.permissions,
        isActive: data.isActive,
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return {
        ok: false,
        fieldErrors: { name: "Энэ нэртэй үүрэг аль хэдийн байна." },
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
    entity: "Role",
    entityId: id,
    action: "UPDATE",
    summary: `${data.name} · ${data.permissions.length} эрх`,
    before: {
      name: target.name,
      permissions: target.permissions,
      isActive: target.isActive,
    },
    after: {
      name: data.name,
      permissions: data.permissions,
      isActive: data.isActive,
    },
  });

  revalidatePath("/dashboard/employees/roles");
  revalidatePath(`/dashboard/employees/roles/${id}`);
  revalidatePath("/dashboard/employees");
  redirect("/dashboard/employees/roles");
}

// --- DELETE ---------------------------------------------------------------

export async function deleteRoleAction(formData: FormData): Promise<void> {
  const user = await authorize();
  const id = s(formData, "id");
  if (!id) return;

  const target = await prisma.role.findFirst({
    where: { id, tenantId: user.tenantId },
    include: { _count: { select: { users: true } } },
  });
  if (!target) return;
  if (target._count.users > 0) {
    throw new Error(
      `Энэ үүрэгтэй ${target._count.users} ажилтан байна. Эхлээд тэдний үүргийг солино уу.`,
    );
  }

  await prisma.role.delete({ where: { id: target.id } });

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "Role",
    entityId: id,
    action: "DELETE",
    summary: target.name,
  });

  revalidatePath("/dashboard/employees/roles");
  revalidatePath("/dashboard/employees");
}

