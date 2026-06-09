"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/system";
import { prisma } from "@/lib/prisma";

export type SettingsActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function isUrlOrEmpty(v: string): boolean {
  return !v || /^https?:\/\/.+/i.test(v);
}

export async function updatePlatformSettings(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  await requireSuperAdmin();

  const facebookUrl = s(formData, "facebookUrl");
  const youtubeUrl = s(formData, "youtubeUrl");

  const fieldErrors: Record<string, string> = {};
  if (!isUrlOrEmpty(facebookUrl))
    fieldErrors.facebookUrl = "http(s):// эхэлсэн хаяг оруулна уу.";
  if (!isUrlOrEmpty(youtubeUrl))
    fieldErrors.youtubeUrl = "http(s):// эхэлсэн хаяг оруулна уу.";
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  await prisma.platformSetting.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      facebookUrl: facebookUrl || null,
      youtubeUrl: youtubeUrl || null,
    },
    update: {
      facebookUrl: facebookUrl || null,
      youtubeUrl: youtubeUrl || null,
    },
  });

  revalidatePath("/system/settings");
  revalidatePath("/page/landing");
  return { ok: true, message: "Хадгалагдлаа." };
}
