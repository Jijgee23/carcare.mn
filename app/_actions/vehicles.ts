"use server";


import type { ConfirmActionResult } from "@/lib/confirm-action";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canCreate, canDelete, canEdit } from "@/lib/auth/roles";
import { assertActiveSubscription } from "@/lib/subscription-server";
import {
  VehicleCommandError,
  createVehicleCommand,
  deleteVehicleCommand,
  updateVehicleCommand,
} from "@/lib/vehicles/vehicle-commands";

export type VehicleActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

async function authorize(action: "create" | "edit" | "delete") {
  const user = await requireUser();
  const ok =
    action === "create"
      ? canCreate(user, "vehicles")
      : action === "edit"
        ? canEdit(user, "vehicles")
        : canDelete(user, "vehicles");
  if (!ok) {
    throw new Error("Танд машинд энэ үйлдэл хийх эрх байхгүй.");
  }
  await assertActiveSubscription(user.tenantId);
  return user;
}

function formInput(fd: FormData) {
  return {
    plate: s(fd, "plate"),
    vin: s(fd, "vin"),
    make: s(fd, "make"),
    model: s(fd, "model"),
    year: s(fd, "year"),
    mileage: s(fd, "mileage"),
    fuelType: s(fd, "fuelType"),
    wheelPosition: s(fd, "wheelPosition"),
    colorName: s(fd, "colorName"),
    capacity: s(fd, "capacity"),
    purpose: s(fd, "purpose"),
    ownerRegnum: s(fd, "ownerRegnum"),
    customerId: s(fd, "customerId"),
    isPostpaid: fd.get("isPostpaid") === "on",
  };
}

// --- CREATE ---------------------------------------------------------------

export async function createVehicleAction(
  _prev: VehicleActionState,
  formData: FormData,
): Promise<VehicleActionState> {
  let user;
  try {
    user = await authorize("create");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  let record;
  try {
    record = await createVehicleCommand({
      actor: user,
      data: formInput(formData),
      // Хуучин зан төлөв хэвээр: зөвхөн dashboard-ын бүрэн create action
      rejectDuplicate: true,
    });
  } catch (e) {
    if (e instanceof VehicleCommandError) {
      if (e.fieldErrors) return { ok: false, fieldErrors: e.fieldErrors };
      return { ok: false, message: e.message };
    }
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Үүсгэх явцад алдаа гарлаа.",
    };
  }

  revalidatePath("/dashboard/vehicles");
  revalidatePath("/dashboard/customers");
  if (record.customerId) {
    revalidatePath(`/dashboard/customers/${record.customerId}`);
  }
  redirect(
    record.customerId
      ? `/dashboard/customers/${record.customerId}`
      : "/dashboard/vehicles",
  );
}

// --- UPDATE ---------------------------------------------------------------

export async function updateVehicleAction(
  id: string,
  _prev: VehicleActionState,
  formData: FormData,
): Promise<VehicleActionState> {
  let user;
  try {
    user = await authorize("edit");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  let record;
  try {
    record = await updateVehicleCommand({
      actor: user,
      vehicleId: id,
      data: formInput(formData),
    });
  } catch (e) {
    if (e instanceof VehicleCommandError) {
      if (e.fieldErrors) return { ok: false, fieldErrors: e.fieldErrors };
      return { ok: false, message: e.message };
    }
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Шинэчлэх явцад алдаа гарлаа.",
    };
  }

  revalidatePath("/dashboard/vehicles");
  revalidatePath(`/dashboard/vehicles/${id}`);
  revalidatePath("/dashboard/customers");
  if (record.customerId) {
    revalidatePath(`/dashboard/customers/${record.customerId}`);
  }
  redirect("/dashboard/vehicles");
}

// --- DELETE ---------------------------------------------------------------

export async function deleteVehicleAction(formData: FormData): Promise<ConfirmActionResult> {
  const user = await authorize("delete");
  const id = s(formData, "id");
  if (!id) return;

  try {
    await deleteVehicleCommand({ actor: user, vehicleId: id });
  } catch (e) {
    if (e instanceof VehicleCommandError && e.code === "VEHICLE_NOT_FOUND") {
      return;
    }
    if (e instanceof VehicleCommandError) return { error: e.message };
    throw e;
  }

  revalidatePath("/dashboard/vehicles");
  revalidatePath("/dashboard/customers");
}
