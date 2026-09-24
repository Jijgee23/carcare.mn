"use server";


import { isForeignKeyViolation } from "@/lib/prisma-errors";
import type { ConfirmActionResult } from "@/lib/confirm-action";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/system";
import { prisma } from "@/lib/prisma";

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function suspendTenantAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = s(formData, "id");
  if (!id) return;
  await prisma.tenant.update({
    where: { id },
    data: { suspended: true },
  });
  revalidatePath("/system/tenants");
  revalidatePath(`/system/tenants/${id}`);
  revalidatePath("/system");
}

export async function activateTenantAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = s(formData, "id");
  if (!id) return;
  await prisma.tenant.update({
    where: { id },
    data: { suspended: false },
  });
  revalidatePath("/system/tenants");
  revalidatePath(`/system/tenants/${id}`);
  revalidatePath("/system");
}

export async function changeTenantPlanAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = s(formData, "id");
  const plan = s(formData, "plan");
  if (!id) return;
  if (!["FREE", "BUSINESS", "ENTERPRISE"].includes(plan)) {
    throw new Error("Багц буруу.");
  }
  await prisma.tenant.update({
    where: { id },
    data: { plan: plan as "FREE" | "BUSINESS" | "ENTERPRISE" },
  });
  revalidatePath("/system/tenants");
  revalidatePath(`/system/tenants/${id}`);
  revalidatePath("/system");
}

export async function deleteTenantAction(formData: FormData): Promise<ConfirmActionResult> {
  await requireSuperAdmin();
  const id = s(formData, "id");
  const confirm = s(formData, "confirmName");
  if (!id) return;

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: { name: true },
  });
  if (!tenant) return { error: "Байгууллага олдсонгүй." };
  if (confirm !== tenant.name) {
    return { error: "Баталгаажуулалт буруу. Байгууллагын нэрийг яг адил бичнэ үү." };
  }

  try {
    await prisma.tenant.delete({ where: { id } });
  } catch (e) {
    if (isForeignKeyViolation(e)) {
      return { error: "Энэ байгууллага санхүү/аудитын түүхтэй (төлбөр, лог) тул устгах боломжгүй. Оронд нь идэвхгүй болгоно уу." };
    }
    throw e;
  }
  revalidatePath("/system/tenants");
  revalidatePath("/system");
  redirect("/system/tenants");
}
