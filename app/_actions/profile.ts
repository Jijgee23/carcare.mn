"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { getSession, requireUser } from "@/lib/auth";
import { changePassword } from "@/lib/account/password";
import { updateProfile } from "@/lib/account/profile";
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

export async function updateProfileAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await requireUser();

  const result = await updateProfile(
    prisma,
    { id: user.id, tenantId: user.tenantId },
    {
      firstName: s(formData, "firstName"),
      lastName: s(formData, "lastName"),
      email: s(formData, "email"),
      phone: s(formData, "phone"),
    },
  );

  if (!result.ok) {
    return { ok: false, fieldErrors: result.fieldErrors, message: result.message };
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "User",
    entityId: user.id,
    action: "UPDATE",
    summary: "Профайл шинэчлэв",
    after: result.data,
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
  const session = await getSession();

  const result = await changePassword(
    prisma,
    { id: user.id, tenantId: user.tenantId, passwordHash: user.passwordHash },
    {
      currentPassword: s(formData, "currentPassword"),
      newPassword: s(formData, "newPassword"),
      confirmPassword: s(formData, "confirmPassword"),
    },
    { currentSessionId: session?.sid ?? null },
  );

  if (!result.ok) {
    return { ok: false, fieldErrors: result.fieldErrors, message: result.message };
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "User",
    entityId: user.id,
    action: "UPDATE",
    summary: "Нууц үг солив",
  });

  revalidatePath("/dashboard/profile");
  return { ok: true, message: "Нууц үг солигдлоо." };
}
