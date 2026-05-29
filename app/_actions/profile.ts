"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

export type ProfileActionState = {
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

export async function updateProfileAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await requireUser();

  const firstName = s(formData, "firstName");
  const lastName = s(formData, "lastName");
  const email = s(formData, "email");
  const phone = s(formData, "phone");

  const fieldErrors: Record<string, string> = {};
  if (!firstName) fieldErrors.firstName = "Нэрээ оруулна уу.";
  if (!lastName) fieldErrors.lastName = "Овгоо оруулна уу.";
  if (!isEmail(email)) fieldErrors.email = "Имэйл хаяг буруу.";
  if (!phone) fieldErrors.phone = "Утасны дугаар оруулна уу.";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { firstName, lastName, email, phone },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        fieldErrors: { email: "Энэ имэйл өөр хэрэглэгчид бүртгэгдсэн байна." },
      };
    }
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Алдаа гарлаа.",
    };
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "User",
    entityId: user.id,
    action: "UPDATE",
    summary: "Профайл шинэчлэв",
    after: { firstName, lastName, email, phone },
  });

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
  return { ok: true, message: "Хадгалагдлаа." };
}

export async function changePasswordAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await requireUser();

  const current = s(formData, "currentPassword");
  const next = s(formData, "newPassword");
  const confirm = s(formData, "confirmPassword");

  const fieldErrors: Record<string, string> = {};
  if (!current) fieldErrors.currentPassword = "Одоогийн нууц үгээ оруулна уу.";
  if (next.length < 8)
    fieldErrors.newPassword = "Шинэ нууц үг 8+ тэмдэгт байна.";
  if (next !== confirm)
    fieldErrors.confirmPassword = "Нууц үг таарахгүй байна.";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  const ok = await verifyPassword(current, user.passwordHash);
  if (!ok) {
    return {
      ok: false,
      fieldErrors: { currentPassword: "Одоогийн нууц үг буруу." },
    };
  }

  if (await verifyPassword(next, user.passwordHash)) {
    return {
      ok: false,
      fieldErrors: { newPassword: "Шинэ нууц үг өмнөхөөс өөр байх ёстой." },
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next) },
  });

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "User",
    entityId: user.id,
    action: "UPDATE",
    summary: "Нууц үг солив",
  });

  return { ok: true, message: "Нууц үг солигдлоо." };
}
