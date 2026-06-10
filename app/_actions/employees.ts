"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { canCreate, canDelete, canEdit } from "@/lib/auth/roles";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { PLAN_LIMIT_CODES } from "@/lib/plan-limits";
import { enforceCountLimit } from "@/lib/plan-limits-server";
import { prisma } from "@/lib/prisma";

export type EmployeeActionState = {
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
      ? canCreate(user, "employees")
      : action === "edit"
        ? canEdit(user, "employees")
        : canDelete(user, "employees");
  if (!ok) {
    throw new Error("Танд ажилтанд энэ үйлдэл хийх эрх байхгүй.");
  }
  return user;
}

type Validated = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  roleId: string | null;
  branchId: string | null;
  isActive: boolean;
  activeUntil: Date | null;
};

function validateCommon(fd: FormData): {
  data: Validated;
  errors: Record<string, string>;
} {
  const firstName = s(fd, "firstName");
  const lastName = s(fd, "lastName");
  // Нэвтрэх үед имэйлийг lowercase хийдэг тул хадгалахдаа ч мөн адил болгоно —
  // эс бол том үсэгтэй хадгалсан ажилтан нэвтэрч чадахгүй / давхцал танигдахгүй.
  const email = s(fd, "email").toLowerCase();
  const phone = s(fd, "phone");
  const roleId = s(fd, "roleId");
  const branchIdRaw = s(fd, "branchId");
  const isActive = fd.get("isActive") !== "off"; // default true
  const activeUntilRaw = s(fd, "activeUntil");

  const errors: Record<string, string> = {};
  if (!lastName) errors.lastName = "Овгоо оруулна уу.";
  if (!firstName) errors.firstName = "Нэрээ оруулна уу.";
  if (!isEmail(email)) errors.email = "Имэйл хаяг буруу.";
  if (!phone) errors.phone = "Утасны дугаар оруулна уу.";
  else if (!isValidPhone(phone))
    errors.phone = "Утасны дугаар 8 оронтой тоо байх ёстой.";
  if (!roleId) errors.roleId = "Үүрэг сонгоно уу.";

  let activeUntil: Date | null = null;
  if (activeUntilRaw) {
    const d = new Date(activeUntilRaw);
    if (!Number.isFinite(d.getTime())) {
      errors.activeUntil = "Огноо буруу.";
    } else {
      activeUntil = d;
    }
  }

  return {
    data: {
      firstName,
      lastName,
      email,
      // Канон 8 оронтой хэлбэрт хадгална (давхцал шалгахад тогтвортой байх).
      phone: normalizePhone(phone) ?? phone,
      roleId: roleId || null,
      branchId: branchIdRaw || null,
      isActive,
      activeUntil,
    },
    errors,
  };
}

/**
 * P2002 (давхцал) гарсан үед ЯГ аль unique талбар давхцсаныг тогтооно.
 *
 * `e.meta.target`-д найдаж болохгүй: pg драйвер адаптер нь PostgreSQL-ийн
 * `error.detail` ("Key (phone)=(...) ...")-ыг англи хэлний regex-ээр задалдаг
 * тул серверийн `lc_messages` англи биш бол талбарын нэр олдохгүй →
 * `meta.target` undefined болж буруу талбарт (имэйл) алдаа заадаг байсан.
 * Иймд утас/имэйл аль аль нь өөр хэрэглэгчид байгаа эсэхийг шууд лавлана.
 * Утас, имэйл хоёул глобал unique тул tenant-аар шүүхгүй.
 */
async function duplicateUserFields(
  email: string,
  phone: string,
  excludeUserId?: string,
): Promise<{ phone: boolean; email: boolean }> {
  const not = excludeUserId ? { id: { not: excludeUserId } } : {};
  const [phoneTaken, emailTaken] = await Promise.all([
    prisma.user.findFirst({ where: { phone, ...not }, select: { id: true } }),
    prisma.user.findFirst({ where: { email, ...not }, select: { id: true } }),
  ]);
  return { phone: Boolean(phoneTaken), email: Boolean(emailTaken) };
}

async function ensureRoleBelongsToTenant(
  tenantId: string,
  roleId: string,
): Promise<{ ok: boolean; name?: string }> {
  const role = await prisma.role.findFirst({
    where: { id: roleId, tenantId },
    select: { id: true, name: true, isActive: true },
  });
  if (!role || !role.isActive) return { ok: false };
  return { ok: true, name: role.name };
}

// --- CREATE ---------------------------------------------------------------

export async function createEmployeeAction(
  _prev: EmployeeActionState,
  formData: FormData,
): Promise<EmployeeActionState> {
  let user;
  try {
    user = await authorize("create");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const { data, errors } = validateCommon(formData);
  // Нууц үгийг админ тавихгүй — ажилтан анх удаа нэвтрэхдээ OTP-ээр өөрөө
  // үүсгэнэ (verified=false → идэвхжүүлэх урсгал).
  if (Object.keys(errors).length > 0) {
    return { ok: false, fieldErrors: errors };
  }

  if (data.roleId) {
    const r = await ensureRoleBelongsToTenant(user.tenantId, data.roleId);
    if (!r.ok) {
      return { ok: false, fieldErrors: { roleId: "Үүрэг олдсонгүй эсвэл идэвхгүй байна." } };
    }
  }

  if (data.branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: data.branchId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!branch) {
      return { ok: false, fieldErrors: { branchId: "Салбар олдсонгүй." } };
    }
  }

  // Багцын хязгаар: max_users
  const limit = await enforceCountLimit(
    user.tenantId,
    PLAN_LIMIT_CODES.MAX_USERS,
    () => prisma.user.count({ where: { tenantId: user.tenantId } }),
  );
  if (!limit.allowed) {
    return { ok: false, message: limit.message };
  }

  let created;
  try {
    created = await prisma.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        roleId: data.roleId,
        // Нууц үггүй, баталгаажаагүй — ажилтан анхны нэвтрэлтэд өөрөө үүсгэнэ.
        passwordHash: null,
        verified: false,
        tenantId: user.tenantId,
        branchId: data.branchId,
        isActive: data.isActive,
        activeUntil: data.activeUntil,
      },
      select: { id: true, role: { select: { name: true } } },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const dup = await duplicateUserFields(data.email, data.phone);
      const fe: Record<string, string> = {};
      if (dup.phone) fe.phone = "Энэ утасны дугаар аль хэдийн бүртгэгдсэн байна.";
      if (dup.email) fe.email = "Энэ имэйл хаяг аль хэдийн бүртгэгдсэн байна.";
      if (!fe.phone && !fe.email) {
        fe.phone = "Энэ утас эсвэл имэйл аль хэдийн бүртгэгдсэн байна.";
      }
      return { ok: false, fieldErrors: fe };
    }
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Үүсгэх явцад алдаа гарлаа.",
    };
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "User",
    entityId: created.id,
    action: "CREATE",
    summary: `${data.lastName} ${data.firstName} · ${created.role?.name ?? "—"}`,
    after: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      roleId: data.roleId,
      branchId: data.branchId,
    },
  });

  revalidatePath("/dashboard/employees");
  revalidatePath("/dashboard");
  redirect("/dashboard/employees");
}

// --- UPDATE ---------------------------------------------------------------

export async function updateEmployeeAction(
  id: string,
  _prev: EmployeeActionState,
  formData: FormData,
): Promise<EmployeeActionState> {
  let me;
  try {
    me = await authorize("edit");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const { data, errors } = validateCommon(formData);
  // Админ нууц үг өөрчлөхгүй — ажилтан өөрөө "Нууц үг сэргээх" урсгалаар солино.
  if (Object.keys(errors).length > 0) {
    return { ok: false, fieldErrors: errors };
  }

  const target = await prisma.user.findFirst({
    where: { id, tenantId: me.tenantId },
    include: { role: { select: { id: true, name: true } } },
  });
  if (!target) return { ok: false, message: "Ажилтан олдсонгүй." };

  // OWNER (тенант админ)-ын үүрэг солих, эсвэл хасах боломжгүй.
  if (target.isOwner) {
    return {
      ok: false,
      fieldErrors: {
        roleId: "Тенант админы үүргийг өөрчилж болохгүй.",
      },
    };
  }

  if (data.roleId) {
    const r = await ensureRoleBelongsToTenant(me.tenantId, data.roleId);
    if (!r.ok) {
      return { ok: false, fieldErrors: { roleId: "Үүрэг олдсонгүй эсвэл идэвхгүй байна." } };
    }
  }

  if (data.branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: data.branchId, tenantId: me.tenantId },
      select: { id: true },
    });
    if (!branch) {
      return { ok: false, fieldErrors: { branchId: "Салбар олдсонгүй." } };
    }
  }

  let updated;
  try {
    updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        roleId: data.roleId,
        branchId: data.branchId,
        isActive: data.isActive,
        activeUntil: data.activeUntil,
      },
      select: { id: true, role: { select: { name: true } } },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const dup = await duplicateUserFields(data.email, data.phone, target.id);
      const fe: Record<string, string> = {};
      if (dup.phone) fe.phone = "Энэ утас өөр хэрэглэгчид ашиглагдсан байна.";
      if (dup.email) fe.email = "Энэ имэйл өөр хэрэглэгчид ашиглагдсан байна.";
      if (!fe.phone && !fe.email) {
        fe.phone = "Энэ утас эсвэл имэйл өөр хэрэглэгчид ашиглагдсан байна.";
      }
      return { ok: false, fieldErrors: fe };
    }
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Шинэчлэх явцад алдаа гарлаа.",
    };
  }

  await logAudit({
    tenantId: me.tenantId,
    userId: me.id,
    entity: "User",
    entityId: id,
    action: "UPDATE",
    summary: `${data.lastName} ${data.firstName} · ${updated.role?.name ?? "—"}`,
    before: {
      firstName: target.firstName,
      lastName: target.lastName,
      email: target.email,
      roleId: target.roleId,
      branchId: target.branchId,
    },
    after: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      roleId: data.roleId,
      branchId: data.branchId,
    },
  });

  revalidatePath("/dashboard/employees");
  revalidatePath(`/dashboard/employees/${id}`);
  redirect("/dashboard/employees");
}

// --- ACTIVATE / DEACTIVATE -----------------------------------------------

export async function toggleEmployeeActiveAction(
  formData: FormData,
): Promise<void> {
  const me = await authorize("edit");
  const id = s(formData, "id");
  const next = formData.get("isActive") === "on";
  if (!id) return;
  if (id === me.id && !next) {
    throw new Error("Та өөрийгөө идэвхгүй болгох боломжгүй.");
  }

  const target = await prisma.user.findFirst({
    where: { id, tenantId: me.tenantId },
    select: {
      isOwner: true,
      isActive: true,
      firstName: true,
      lastName: true,
    },
  });
  if (!target) return;
  if (target.isOwner && !next) {
    const activeOwners = await prisma.user.count({
      where: { tenantId: me.tenantId, isOwner: true, isActive: true },
    });
    if (activeOwners <= 1) {
      throw new Error("Сүүлийн админыг идэвхгүй болгох боломжгүй.");
    }
  }

  await prisma.user.update({
    where: { id },
    data: { isActive: next },
  });

  await logAudit({
    tenantId: me.tenantId,
    userId: me.id,
    entity: "User",
    entityId: id,
    action: "UPDATE",
    summary: `${target.lastName} ${target.firstName} · ${next ? "идэвхжүүлэв" : "идэвхгүй болгов"}`,
    before: { isActive: target.isActive },
    after: { isActive: next },
  });

  revalidatePath("/dashboard/employees");
  revalidatePath(`/dashboard/employees/${id}`);
}

// --- DELETE ---------------------------------------------------------------

export async function deleteEmployeeAction(formData: FormData): Promise<void> {
  const me = await authorize("delete");
  const id = s(formData, "id");
  if (!id) return;
  if (id === me.id) {
    throw new Error("Та өөрийгөө устгах боломжгүй.");
  }

  const target = await prisma.user.findFirst({
    where: { id, tenantId: me.tenantId },
    include: { role: { select: { name: true } } },
  });
  if (!target) return;

  if (target.isOwner) {
    const ownerCount = await prisma.user.count({
      where: { tenantId: me.tenantId, isOwner: true },
    });
    if (ownerCount <= 1) {
      throw new Error("Сүүлийн админыг устгах боломжгүй.");
    }
  }

  try {
    await prisma.user.delete({ where: { id: target.id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      throw new Error(
        "Энэ ажилтан захиалгатай холбоотой тул устгах боломжгүй.",
      );
    }
    throw e;
  }

  await logAudit({
    tenantId: me.tenantId,
    userId: me.id,
    entity: "User",
    entityId: id,
    action: "DELETE",
    summary: `${target.lastName} ${target.firstName} · ${target.role?.name ?? (target.isOwner ? "Админ" : "—")}`,
  });

  revalidatePath("/dashboard/employees");
  revalidatePath("/dashboard");
}
