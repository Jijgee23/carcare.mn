"use server";


import type { ConfirmActionResult } from "@/lib/confirm-action";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canCreate, canDelete, canEdit, hasPermission } from "@/lib/auth/roles";
import { assertActiveSubscription } from "@/lib/subscription-server";
import {
  CustomerCommandError,
  createCustomerCommand,
  deleteCustomerCommand,
  updateCustomerCommand,
  type CustomerCommandInput,
} from "@/lib/customers/customer-commands";
import {
  CustomerBroadcastError,
  sendCustomerBroadcast,
} from "@/lib/customers/customer-broadcast";

export type CustomerActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

export type CustomerNotifyActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function formInput(fd: FormData): CustomerCommandInput {
  return {
    fullName: s(fd, "fullName"),
    phone: s(fd, "phone"),
    email: s(fd, "email") || null,
    note: s(fd, "note") || null,
  };
}

async function authorize(action: "create" | "edit" | "delete") {
  const user = await requireUser();
  const ok =
    action === "create"
      ? canCreate(user, "customers")
      : action === "edit"
        ? canEdit(user, "customers")
        : canDelete(user, "customers");
  if (!ok) {
    throw new Error("Танд үйлчлүүлэгчид энэ үйлдэл хийх эрх байхгүй.");
  }
  await assertActiveSubscription(user.tenantId);
  return user;
}

export async function createCustomerAction(
  _prev: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  let user;
  try {
    user = await authorize("create");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  let result;
  try {
    result = await createCustomerCommand({
      actor: user,
      data: formInput(formData),
    });
  } catch (e) {
    if (e instanceof CustomerCommandError) {
      if (e.fieldErrors) return { ok: false, fieldErrors: e.fieldErrors };
      return { ok: false, message: e.message };
    }
    throw e;
  }

  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");
  redirect(`/dashboard/customers/${result.customer.id}`);
}

export async function updateCustomerAction(
  id: string,
  _prev: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  let user;
  try {
    user = await authorize("edit");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
  }

  try {
    await updateCustomerCommand({ actor: user, customerId: id, data: formInput(formData) });
  } catch (e) {
    if (e instanceof CustomerCommandError) {
      if (e.fieldErrors) return { ok: false, fieldErrors: e.fieldErrors };
      return { ok: false, message: e.message };
    }
    throw e;
  }

  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${id}`);
  redirect("/dashboard/customers");
}

export async function deleteCustomerAction(formData: FormData): Promise<ConfirmActionResult> {
  const user = await authorize("delete");
  const id = s(formData, "id");
  if (!id) return;

  try {
    await deleteCustomerCommand({ actor: user, customerId: id });
  } catch (e) {
    if (e instanceof CustomerCommandError) {
      return { error: e.message };
    }
    throw e;
  }

  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");
}

// --- NOTIFY (broadcast to own customers) -----------------------------------

/**
 * Тухайн тенантын онлайн бүртгэлтэй (Account холбогдсон) бүх үйлчлүүлэгчид
 * зар/урамслал (жишээ нь хямдрал) push мэдэгдэл илгээнэ. `customers.notify`
 * тусгай эрхтэй хэрэглэгч л ашиглана — `customers.view`/`edit`-ээс тусдаа
 * (харах: lib/auth/permissions.ts тайлбар).
 */
export async function sendCustomerBroadcastAction(
  _prev: CustomerNotifyActionState,
  formData: FormData,
): Promise<CustomerNotifyActionState> {
  const user = await requireUser();
  if (!hasPermission(user, "customers.notify")) {
    return { ok: false, message: "Танд үйлчлүүлэгчид зар илгээх эрх байхгүй." };
  }
  await assertActiveSubscription(user.tenantId);

  const title = s(formData, "title");
  const body = s(formData, "body");

  const fieldErrors: Record<string, string> = {};
  if (!title) fieldErrors.title = "Гарчиг оруулна уу.";
  if (!body) fieldErrors.body = "Агуулга оруулна уу.";
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  // P3-B7: канон "daily limit → broadcastTenantPromo → audit" дараалал
  // `lib/customers/customer-broadcast.ts`-д нэгдсэн — энэ action зөвхөн
  // thin adapter. Зан төлөв (мессеж, 0 хүлээн авагчийн тохиолдол) хэвээр.
  let notified: number;
  try {
    const result = await sendCustomerBroadcast({
      actor: user,
      data: { title, body },
    });
    notified = result.notified;
  } catch (e) {
    if (e instanceof CustomerBroadcastError) {
      return { ok: false, message: e.message };
    }
    throw e;
  }

  if (notified === 0) {
    return {
      ok: true,
      message: "Илгээгдлээ, гэхдээ онлайн бүртгэлтэй (апп/веб холбогдсон) үйлчлүүлэгч алга байна.",
    };
  }
  return {
    ok: true,
    message: `Илгээгдлээ — ${notified.toLocaleString("mn-MN")} үйлчлүүлэгчид хүрлээ.`,
  };
}
