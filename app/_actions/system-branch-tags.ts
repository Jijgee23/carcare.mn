"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { requireSuperAdmin } from "@/lib/auth/system";
import { prisma } from "@/lib/prisma";

export type BranchTagActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function parse(fd: FormData): {
  name: string;
  description: string | null;
  isActive: boolean;
  errors: Record<string, string>;
} {
  const name = s(fd, "name");
  const description = s(fd, "description");
  const isActive = fd.get("isActive") === "on";
  const errors: Record<string, string> = {};

  if (!name) errors.name = "Нэрээ оруулна уу.";
  else if (name.length > 80) errors.name = "Нэр 80 тэмдэгтээс хэтрэхгүй.";
  if (description && description.length > 200)
    errors.description = "Тайлбар 200 тэмдэгтээс хэтрэхгүй.";

  return { name, description: description || null, isActive, errors };
}

export async function createBranchTagAction(
  _prev: BranchTagActionState,
  formData: FormData,
): Promise<BranchTagActionState> {
  const actor = await requireSuperAdmin();

  const { name, description, isActive, errors } = parse(formData);
  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

  try {
    await prisma.branchTag.create({
      data: { name, description, isActive, createdById: actor.id },
      select: { id: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        fieldErrors: { name: "Энэ нэртэй шошго аль хэдийн бүртгэлтэй байна." },
      };
    }
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Үүсгэхэд алдаа гарлаа.",
    };
  }

  revalidatePath("/system/branch-tags");
  return { ok: true, message: "Үүсгэлээ." };
}

export async function updateBranchTagAction(
  id: string,
  _prev: BranchTagActionState,
  formData: FormData,
): Promise<BranchTagActionState> {
  await requireSuperAdmin();

  const { name, description, isActive, errors } = parse(formData);
  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

  try {
    await prisma.branchTag.update({
      where: { id },
      data: { name, description, isActive },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        fieldErrors: { name: "Энэ нэртэй шошго аль хэдийн бүртгэлтэй байна." },
      };
    }
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Шинэчлэхэд алдаа гарлаа.",
    };
  }

  revalidatePath("/system/branch-tags");
  revalidatePath(`/system/branch-tags/${id}`);
  return { ok: true, message: "Хадгалагдлаа." };
}

export async function deleteBranchTagAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = s(formData, "id");
  if (!id) return;

  const usedCount = await prisma.branch.count({
    where: { tags: { some: { id } } },
  });

  if (usedCount > 0) {
    // Салбарууд аль хэдийн ашиглаж байгаа тул устгахгүй, зөвхөн идэвхгүй
    // болгоно (шинэ салбар холбогдохоос сэргийлнэ).
    await prisma.branchTag.update({
      where: { id },
      data: { isActive: false },
    });
  } else {
    await prisma.branchTag.delete({ where: { id } });
  }

  revalidatePath("/system/branch-tags");
}
