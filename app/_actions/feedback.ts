"use server";

import { revalidatePath } from "next/cache";
import type { FeedbackType } from "@/app/generated/prisma/client";
import { requireAccount } from "@/lib/auth/account";
import { requireUser } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/auth/system";
import { isFeedbackStatus, isFeedbackType } from "@/lib/feedback";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { saveUpload } from "@/lib/storage";

export type FeedbackActionState = {
  ok: boolean;
  message?: string;
} | null;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function parseInput(
  fd: FormData,
): { type: FeedbackType; message: string; pageUrl: string; userAgent: string } | null {
  const rawType = s(fd, "type");
  const message = s(fd, "message");
  const pageUrl = s(fd, "pageUrl").slice(0, 500);
  const userAgent = s(fd, "userAgent").slice(0, 500);
  if (!isFeedbackType(rawType)) return null;
  if (message.length < 5 || message.length > 2000) return null;
  return { type: rawType, message, pageUrl, userAgent };
}

/** `screenshot` талбар сонгогдсон бол хадгалж URL буцаана; сонгоогүй бол null. */
async function saveScreenshot(fd: FormData): Promise<string | null> {
  const file = fd.get("screenshot");
  if (!(file instanceof File) || file.size === 0) return null;
  const saved = await saveUpload(file, "feedback");
  return saved.path;
}

/** Ажилтны (dashboard) талаас санал хүсэлт/алдаа мэдээлэх. */
export async function submitStaffFeedback(
  _prevState: FeedbackActionState,
  formData: FormData,
): Promise<FeedbackActionState> {
  const user = await requireUser();
  const input = parseInput(formData);
  if (!input) {
    return { ok: false, message: "Мессеж 5-2000 тэмдэгт байх ёстой." };
  }
  let screenshotUrl: string | null;
  try {
    screenshotUrl = await saveScreenshot(formData);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Зураг хадгалахад алдаа гарлаа." };
  }

  await prisma.feedback.create({
    data: {
      tenantId: user.tenantId,
      userId: user.id,
      type: input.type,
      message: input.message,
      screenshotUrl,
      pageUrl: input.pageUrl || null,
      userAgent: input.userAgent || null,
    },
  });

  return { ok: true, message: "Санал хүсэлт илгээгдлээ. Баярлалаа!" };
}

/** Үйлчлүүлэгчийн (account) талаас санал хүсэлт/алдаа мэдээлэх. */
export async function submitAccountFeedback(
  _prevState: FeedbackActionState,
  formData: FormData,
): Promise<FeedbackActionState> {
  const account = await requireAccount();
  const input = parseInput(formData);
  if (!input) {
    return { ok: false, message: "Мессеж 5-2000 тэмдэгт байх ёстой." };
  }
  let screenshotUrl: string | null;
  try {
    screenshotUrl = await saveScreenshot(formData);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Зураг хадгалахад алдаа гарлаа." };
  }

  await prisma.feedback.create({
    data: {
      accountId: account.id,
      type: input.type,
      message: input.message,
      screenshotUrl,
      pageUrl: input.pageUrl || null,
      userAgent: input.userAgent || null,
    },
  });

  return { ok: true, message: "Санал хүсэлт илгээгдлээ. Баярлалаа!" };
}

/** SuperAdmin: feedback-ийн төлөв/тэмдэглэл шинэчлэх. */
export async function updateFeedbackStatus(
  _prevState: FeedbackActionState,
  formData: FormData,
): Promise<FeedbackActionState> {
  await requireSuperAdmin();
  const id = s(formData, "id");
  const status = s(formData, "status");
  const adminNote = s(formData, "adminNote").slice(0, 2000);
  if (!id || !isFeedbackStatus(status)) {
    return { ok: false, message: "Буруу оролт." };
  }

  await prisma.feedback.update({
    where: { id },
    data: {
      status,
      adminNote: adminNote || null,
      resolvedAt: status === "RESOLVED" ? new Date() : null,
    },
  });

  return { ok: true, message: "Хадгалагдлаа." };
}

/**
 * SuperAdmin: илгээгчид харагдах хариу бичиж (FeedbackMessage), Notification-оор
 * мэдэгдэнэ (dashboard/notifications эсвэл account/notifications-д body нь
 * хариу текст).
 */
export async function replyToFeedback(
  _prevState: FeedbackActionState,
  formData: FormData,
): Promise<FeedbackActionState> {
  await requireSuperAdmin();
  const id = s(formData, "id");
  const message = s(formData, "message");
  if (!id || message.length < 2 || message.length > 2000) {
    return { ok: false, message: "Хариу 2-2000 тэмдэгт байх ёстой." };
  }

  const feedback = await prisma.feedback.findUnique({ where: { id } });
  if (!feedback) return { ok: false, message: "Олдсонгүй." };

  await prisma.feedbackMessage.create({
    data: {
      feedbackId: id,
      tenantId: feedback.tenantId,
      author: "ADMIN",
      message,
    },
  });

  if (feedback.userId) {
    await createNotification({
      type: "feedback_replied_staff",
      recipient: { userId: feedback.userId },
      input: { message, feedbackId: feedback.id },
      tenantId: feedback.tenantId,
    });
  } else if (feedback.accountId) {
    await createNotification({
      type: "feedback_replied_account",
      recipient: { accountId: feedback.accountId },
      input: { message, feedbackId: feedback.id },
    });
  }

  revalidatePath(`/system/feedback/${id}`);
  return { ok: true, message: "Хариу илгээгдлээ." };
}

/**
 * Tenant (dashboard) тал: өөрсдийн илгээсэн feedback дээр SuperAdmin-д
 * хариу бичих. Шийдэгдсэн/хаагдсан feedback дээр шинэ хариу ирвэл дахин
 * "Хянаж буй" болгож админы анхаарлыг татна.
 */
export async function addSubmitterFeedbackReply(
  _prevState: FeedbackActionState,
  formData: FormData,
): Promise<FeedbackActionState> {
  const user = await requireUser();
  const id = s(formData, "id");
  const message = s(formData, "message");
  if (!id || message.length < 2 || message.length > 2000) {
    return { ok: false, message: "Хариу 2-2000 тэмдэгт байх ёстой." };
  }

  const feedback = await prisma.feedback.findFirst({
    where: { id, tenantId: user.tenantId },
  });
  if (!feedback) return { ok: false, message: "Олдсонгүй." };

  await prisma.feedbackMessage.create({
    data: {
      feedbackId: id,
      tenantId: user.tenantId,
      author: "SUBMITTER",
      message,
    },
  });

  if (feedback.status === "RESOLVED" || feedback.status === "DISMISSED") {
    await prisma.feedback.update({
      where: { id },
      data: { status: "IN_REVIEW", resolvedAt: null },
    });
  }

  revalidatePath(`/dashboard/feedback/${id}`);
  return { ok: true, message: "Хариу илгээгдлээ." };
}
