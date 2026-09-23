// Framework-free role business rules, moved from `app/_actions/roles.ts`
// (P6-B0). No `redirect`/`revalidatePath`/cookies/`"use server"`/
// `server-only` imports here — audit logging and revalidation stay in the
// action wrapper.

import type { RoleActor, RolesClient, ValidatedRole } from "./types";
import { s, validate } from "./validate";

export type FieldErr = {
  ok: false;
  code: "VALIDATION";
  error: string;
  fieldErrors: Record<string, string>;
};

export type MessageErr = {
  ok: false;
  code: "NOT_FOUND" | "DUPLICATE" | "UNKNOWN" | "ROLE_IN_USE";
  error: string;
};

// --- CREATE ---------------------------------------------------------------

export type CreateRoleResult =
  | {
      ok: true;
      id: string;
      summary: string;
      after: Record<string, unknown>;
    }
  | FieldErr
  | MessageErr;

export async function createRole(
  db: RolesClient,
  actor: RoleActor,
  formData: FormData,
): Promise<CreateRoleResult> {
  const { data, errors } = validate(formData);
  if (Object.keys(errors).length > 0) {
    return { ok: false, code: "VALIDATION", error: "Оруулсан мэдээлэл буруу.", fieldErrors: errors };
  }

  let created;
  try {
    created = await db.role.create({
      data: {
        tenantId: actor.tenantId,
        name: data.name,
        description: data.description,
        permissions: data.permissions,
        isActive: data.isActive,
      },
      select: { id: true, name: true },
    });
  } catch (e) {
    if (isP2002(e)) {
      return {
        ok: false,
        code: "DUPLICATE",
        error: "Энэ нэртэй үүрэг аль хэдийн байна.",
      };
    }
    return {
      ok: false,
      code: "UNKNOWN",
      error: e instanceof Error ? e.message : "Үүсгэх явцад алдаа гарлаа.",
    };
  }

  return {
    ok: true,
    id: created.id,
    summary: `${data.name} · ${data.permissions.length} эрх`,
    after: { name: data.name, permissions: data.permissions, isActive: data.isActive },
  };
}

// --- UPDATE ---------------------------------------------------------------

export type UpdateRoleResult =
  | {
      ok: true;
      id: string;
      summary: string;
      before: Record<string, unknown>;
      after: Record<string, unknown>;
    }
  | FieldErr
  | MessageErr;

export async function updateRole(
  db: RolesClient,
  actor: RoleActor,
  id: string,
  formData: FormData,
): Promise<UpdateRoleResult> {
  const { data, errors } = validate(formData);
  if (Object.keys(errors).length > 0) {
    return { ok: false, code: "VALIDATION", error: "Оруулсан мэдээлэл буруу.", fieldErrors: errors };
  }

  const target = await db.role.findFirst({ where: { id, tenantId: actor.tenantId } });
  if (!target) return { ok: false, code: "NOT_FOUND", error: "Үүрэг олдсонгүй." };

  try {
    await db.role.update({
      where: { id: target.id },
      data: {
        name: data.name,
        description: data.description,
        permissions: data.permissions,
        isActive: data.isActive,
      },
    });
  } catch (e) {
    if (isP2002(e)) {
      return {
        ok: false,
        code: "DUPLICATE",
        error: "Энэ нэртэй үүрэг аль хэдийн байна.",
      };
    }
    return {
      ok: false,
      code: "UNKNOWN",
      error: e instanceof Error ? e.message : "Шинэчлэх явцад алдаа гарлаа.",
    };
  }

  return {
    ok: true,
    id,
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
  };
}

// --- DELETE ---------------------------------------------------------------

export type Noop = { ok: true; noop: true };

export type DeleteRoleResult =
  | Noop
  | { ok: true; id: string; summary: string }
  | { ok: false; code: "ROLE_IN_USE"; error: string };

export async function deleteRole(
  db: RolesClient,
  actor: RoleActor,
  formData: FormData,
): Promise<DeleteRoleResult> {
  const id = s(formData, "id");
  if (!id) return { ok: true, noop: true };

  const target = await db.role.findFirst({
    where: { id, tenantId: actor.tenantId },
    include: { _count: { select: { users: true } } },
  });
  if (!target) return { ok: true, noop: true };
  const userCount = target._count?.users ?? 0;
  if (userCount > 0) {
    return {
      ok: false,
      code: "ROLE_IN_USE",
      error: `Энэ үүрэгтэй ${userCount} ажилтан байна. Эхлээд тэдний үүргийг солино уу.`,
    };
  }

  await db.role.delete({ where: { id: target.id } });

  return { ok: true, id, summary: target.name ?? "" };
}

// --- helpers ---------------------------------------------------------------

function isP2002(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "P2002" &&
    "clientVersion" in e
  );
}

export type { ValidatedRole };
