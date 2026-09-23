"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { createRole, deleteRole, updateRole } from "@/lib/roles/core";
import type { RoleActor } from "@/lib/roles/types";
import { prisma } from "@/lib/prisma";

export type RoleActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

async function authorize(): Promise<RoleActor> {
  const user = await requireUser();
  // Зөвхөн тенант админ (OWNER) Role-ийн жагсаалтыг удирдана. Бусдад өөрсдийн
  // permission байсан ч энэ нь маш чухал учир OWNER-аар хязгаарлав.
  if (!user.isOwner) {
    throw new Error("Зөвхөн тенант админ үүргийг удирдана.");
  }
  return user;
}

// --- CREATE ---------------------------------------------------------------

export async function createRoleAction(
  _prev: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  let user: RoleActor;
  try {
    user = await authorize();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const result = await createRole(prisma, user, formData);
  if (!result.ok) {
    return "fieldErrors" in result
      ? { ok: false, fieldErrors: result.fieldErrors }
      : { ok: false, message: result.error };
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "Role",
    entityId: result.id,
    action: "CREATE",
    summary: result.summary,
    after: result.after as Prisma.InputJsonValue,
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
  let user: RoleActor;
  try {
    user = await authorize();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  const result = await updateRole(prisma, user, id, formData);
  if (!result.ok) {
    return "fieldErrors" in result
      ? { ok: false, fieldErrors: result.fieldErrors }
      : { ok: false, message: result.error };
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "Role",
    entityId: id,
    action: "UPDATE",
    summary: result.summary,
    before: result.before as Prisma.InputJsonValue,
    after: result.after as Prisma.InputJsonValue,
  });

  revalidatePath("/dashboard/employees/roles");
  revalidatePath(`/dashboard/employees/roles/${id}`);
  revalidatePath("/dashboard/employees");
  redirect("/dashboard/employees/roles");
}

// --- DELETE ---------------------------------------------------------------

export async function deleteRoleAction(formData: FormData): Promise<void> {
  const user = await authorize();
  const result = await deleteRole(prisma, user, formData);
  if ("noop" in result) return;
  if (!result.ok) {
    throw new Error(result.error);
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "Role",
    entityId: result.id,
    action: "DELETE",
    summary: result.summary,
  });

  revalidatePath("/dashboard/employees/roles");
  revalidatePath("/dashboard/employees");
}
