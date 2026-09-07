"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { branchScopeId, hasPermission } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";

export type BranchDurationActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

type Actor = Awaited<ReturnType<typeof requireUser>>;

/**
 * Override-ыг ямар салбарт бичихийг шийднэ — booking v2 branch-scope дүрэм:
 *  - Салбар-мастер (non-owner, салбар оноогдсон) бол ӨӨРИЙН салбарт ШАХАЖ бичнэ
 *    — form-оос ирсэн branchId-г ҮЛ ТООНО. Хамрах хүрээ нь `branchScopeId`
 *    (байнгын оноолт), нэвтрэлтийн working branch БИШ — owner тодорхой салбар
 *    сонгож нэвтэрсэн ч бүх салбарынхыг засах эрхтэй хэвээр.
 *  - Owner (эсвэл салбар оноогоогүй tenant-wide ажилтан) бол form-оос branchId
 *    авах ба тенантад харьяалагдахыг шалгана.
 * Буцаах: зөвшөөрөгдсөн branchId, эсвэл null.
 */
async function resolveTargetBranchId(
  user: Actor,
  requestedBranchId: string,
): Promise<string | null> {
  const scoped = branchScopeId(user);
  if (scoped) return scoped;
  if (!requestedBranchId) return null;
  const branch = await prisma.branch.findFirst({
    where: { id: requestedBranchId, tenantId: user.tenantId },
    select: { id: true },
  });
  return branch?.id ?? null;
}

/**
 * Ангиллын салбар-тусгай хугацааны override-ыг тохируулна/цэвэрлэнэ.
 * `durationMinutes` хоосон → override устгаж, ангиллын default (эсвэл 30) руу
 * буцаана. `services.duration` эрх (эсвэл owner) шаардана.
 */
export async function setBranchCategoryDurationAction(
  _prev: BranchDurationActionState,
  formData: FormData,
): Promise<BranchDurationActionState> {
  const user = await requireUser();
  if (!hasPermission(user, "services.duration")) {
    return { ok: false, message: "Хугацаа тохируулах эрх хүрэлцэхгүй байна." };
  }

  const categoryId = s(formData, "categoryId");
  const requestedBranchId = s(formData, "branchId");
  const durationRaw = s(formData, "durationMinutes");

  if (!categoryId) return { ok: false, message: "Ангилал заагаагүй байна." };

  const branchId = await resolveTargetBranchId(user, requestedBranchId);
  if (!branchId) {
    return { ok: false, message: "Ажиллах салбар тодорхойгүй байна." };
  }

  // Ангилал энэ тенантынх мөн эсэх (өөр тенантын ангилалд бичихээс сэргийлнэ).
  const category = await prisma.category.findFirst({
    where: { id: categoryId, tenantId: user.tenantId },
    select: { id: true, name: true },
  });
  if (!category) return { ok: false, message: "Ангилал олдсонгүй." };

  // Хоосон → override устгах (default руу буцаах).
  if (!durationRaw) {
    await prisma.branchCategoryDuration.deleteMany({
      where: { branchId, categoryId },
    });
    await logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      entity: "BranchCategoryDuration",
      entityId: `${branchId}:${categoryId}`,
      action: "DELETE",
      summary: `${category.name} — салбарын хугацаа цэвэрлэв`,
    });
    revalidatePath("/dashboard/services/durations");
    return { ok: true, message: "Салбарын тохиргоо цэвэрлэгдэж, default руу буцлаа." };
  }

  const n = Number(durationRaw);
  if (!Number.isInteger(n) || n < 5 || n > 600) {
    return {
      ok: false,
      fieldErrors: {
        [categoryId]: "Хугацаа 5–600 минутын хооронд бүхэл тоо байна.",
      },
    };
  }

  await prisma.branchCategoryDuration.upsert({
    where: { branchId_categoryId: { branchId, categoryId } },
    create: { branchId, categoryId, durationMinutes: n },
    update: { durationMinutes: n },
  });

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "BranchCategoryDuration",
    entityId: `${branchId}:${categoryId}`,
    action: "UPDATE",
    summary: `${category.name} — салбарын хугацаа ${n} мин`,
    after: { branchId, categoryId, durationMinutes: n },
  });

  revalidatePath("/dashboard/services/durations");
  return { ok: true, message: "Салбарын хугацаа хадгалагдлаа." };
}
