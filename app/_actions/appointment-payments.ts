"use server";

import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth/account";
import {
  confirmAppointmentPayment,
  retryAppointmentFeeCheckout,
} from "@/lib/appointment-payments";
import { prisma } from "@/lib/prisma";

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/**
 * UI-аас тогтмол дуудна (polling) — QPay-аас тухайн appointment-ийн
 * хураамжийн checkout төлөгдсөн эсэхийг шалгаж, бол Invoice (AppointmentPayment)
 * үүсгэнэ. Дахин дуудсан ч idempotent.
 */
export async function checkAppointmentPaymentAction(
  formData: FormData,
): Promise<{
  ok: boolean;
  paid: boolean;
  message?: string;
  underpaidAmount?: number;
}> {
  const account = await requireAccount();
  const appointmentId = s(formData, "appointmentId");
  if (!appointmentId) {
    return { ok: false, paid: false, message: "ID шаардлагатай." };
  }

  const appt = await prisma.appointment.findFirst({
    where: { id: appointmentId, accountId: account.id },
    select: { id: true },
  });
  if (!appt) return { ok: false, paid: false, message: "Цаг захиалга олдсонгүй." };

  return confirmAppointmentPayment(appt.id);
}

/**
 * Invoice татах үед QPay доголдож checkout эхлээгүй/амжилтгүй болсон
 * тохиолдолд account дахин оролдоно.
 */
export async function retryAppointmentPaymentAction(
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const account = await requireAccount();
  const appointmentId = s(formData, "appointmentId");
  if (!appointmentId) return { ok: false, message: "ID шаардлагатай." };

  const appt = await prisma.appointment.findFirst({
    where: { id: appointmentId, accountId: account.id },
    select: { id: true },
  });
  if (!appt) return { ok: false, message: "Цаг захиалга олдсонгүй." };

  const result = await retryAppointmentFeeCheckout(appt.id);
  if (!result.ok) return { ok: false, message: result.error };

  revalidatePath("/account");
  return { ok: true };
}
