"use server";

import { requireSuperAdmin } from "@/lib/auth/system";
import { broadcastNotification } from "@/lib/notifications";

export type AnnouncementActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function sendAnnouncementAction(
  _prev: AnnouncementActionState,
  formData: FormData,
): Promise<AnnouncementActionState> {
  await requireSuperAdmin();

  const title = s(formData, "title");
  const body = s(formData, "body");
  const targets: ("staff" | "account")[] = [];
  if (formData.get("targetStaff")) targets.push("staff");
  if (formData.get("targetAccount")) targets.push("account");

  const fieldErrors: Record<string, string> = {};
  if (!title) fieldErrors.title = "Гарчиг оруулна уу.";
  if (!body) fieldErrors.body = "Агуулга оруулна уу.";
  if (targets.length === 0)
    fieldErrors.targets = "Дор хаяж нэг хүлээн авагч сонгоно уу.";
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const { staffNotified, accountsNotified } = await broadcastNotification({
    title,
    body,
    targets,
  });

  return {
    ok: true,
    message: `Илгээгдлээ — Ажилтан: ${staffNotified.toLocaleString("mn-MN")}, Хэрэглэгч: ${accountsNotified.toLocaleString("mn-MN")}.`,
  };
}
