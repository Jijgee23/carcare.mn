"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { canCreate, canDelete, canEdit } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth";
import {
  cancelOrderQPayPaymentCommand,
  confirmOrderQPayPaymentCommand,
  createOrderPaymentCommand,
  createOrderQPayInvoiceCommand,
  notifyOrderPaymentReceived,
  OrderPaymentCommandError,
  parseOrderPaymentAmount,
  reverseOrderPaymentCommand,
} from "@/lib/orders/order-payment-commands";
import { ORDER_PAYMENT_METHODS, type OrderPaymentMethod } from "@/lib/orders";

export type OrderPaymentActionState = {
  ok: boolean;
  message?: string;
  paymentId?: string;
} | null;

function s(fd: FormData, key: string): string {
  const value = fd.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof OrderPaymentCommandError ? error.message : fallback;
}

export async function createOrderQPayInvoiceAction(
  _prev: OrderPaymentActionState,
  formData: FormData,
): Promise<OrderPaymentActionState> {
  try {
    const user = await requireUser();
    if (!canCreate(user, "payments")) return { ok: false, message: "Танд төлбөр үүсгэх эрх байхгүй." };
    const orderId = s(formData, "orderId");
    if (!orderId) return { ok: false, message: "Засварын хуудас шаардлагатай." };
    const result = await createOrderQPayInvoiceCommand({ actor: user, orderId });
    revalidatePath(`/dashboard/orders/${orderId}`);
    return { ok: true, paymentId: result.id };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, message: messageFrom(error, "QPay invoice үүсгэхэд алдаа гарлаа.") };
  }
}

export async function checkOrderQPayPaymentAction(
  formData: FormData,
): Promise<{ ok: boolean; paid: boolean; message?: string }> {
  try {
    const user = await requireUser();
    if (!canEdit(user, "payments")) return { ok: false, paid: false, message: "Эрх байхгүй." };
    const paymentId = s(formData, "paymentId");
    if (!paymentId) return { ok: false, paid: false, message: "ID шаардлагатай." };
    const result = await confirmOrderQPayPaymentCommand({ actor: user, paymentId });
    if (!result.paid) return { ok: true, paid: false, message: result.message };
    if (result.newlyPaid) await notifyOrderPaymentReceived({ tenantId: user.tenantId, orderId: result.orderId, amount: result.amount, accountId: result.accountId, appointmentId: result.appointmentId });
    revalidatePath(`/dashboard/orders/${result.orderId}`);
    return { ok: true, paid: true };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, paid: false, message: messageFrom(error, "Төлбөр шалгахад алдаа гарлаа.") };
  }
}

export async function cancelOrderQPayPaymentAction(formData: FormData): Promise<void> {
  try {
    const user = await requireUser();
    if (!canDelete(user, "payments")) return;
    const paymentId = s(formData, "paymentId");
    if (!paymentId) return;
    const result = await cancelOrderQPayPaymentCommand({ actor: user, paymentId });
    revalidatePath(`/dashboard/orders/${result.orderId}`);
  } catch (error) {
    unstable_rethrow(error);
    // Server actions historically return no state for cancellation failures.
  }
}

export async function recordOrderPaymentAction(
  _prev: OrderPaymentActionState,
  formData: FormData,
): Promise<OrderPaymentActionState> {
  try {
    const user = await requireUser();
    if (!canCreate(user, "payments")) return { ok: false, message: "Танд төлбөр бүртгэх эрх байхгүй." };
    const orderId = s(formData, "orderId");
    if (!orderId) return { ok: false, message: "Засварын хуудас шаардлагатай." };
    const method = s(formData, "method");
    if (!(ORDER_PAYMENT_METHODS as readonly string[]).includes(method)) return { ok: false, message: "Төлбөрийн арга буруу." };
    const amount = parseOrderPaymentAmount(s(formData, "amount"));
    if (!amount) return { ok: false, message: "Дүнг зөв оруулна уу." };
    const result = await createOrderPaymentCommand({ actor: user, orderId, method: method as OrderPaymentMethod, amount });
    await notifyOrderPaymentReceived({ tenantId: user.tenantId, orderId: result.orderId, amount: amount.toString(), accountId: result.accountId, appointmentId: result.appointmentId });
    revalidatePath(`/dashboard/orders/${orderId}`);
    revalidatePath("/dashboard/orders");
    return { ok: true, paymentId: result.payment.id };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, message: messageFrom(error, "Хадгалахад алдаа.") };
  }
}

export async function reverseOrderPaymentAction(formData: FormData): Promise<void> {
  try {
    const user = await requireUser();
    if (!canDelete(user, "payments")) return;
    const paymentId = s(formData, "paymentId");
    const orderId = s(formData, "orderId");
    if (!paymentId) return;
    const result = await reverseOrderPaymentCommand({ actor: user, orderId: orderId || undefined, paymentId });
    revalidatePath(`/dashboard/orders/${result.orderId}`);
    revalidatePath("/dashboard/orders");
  } catch (error) {
    unstable_rethrow(error);
    // Server actions historically return no state for reversal failures.
  }
}
