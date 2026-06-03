"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/system";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export type QPaySettingsActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function saveQPaySettingsAction(
  _prev: QPaySettingsActionState,
  formData: FormData,
): Promise<QPaySettingsActionState> {
  await requireSuperAdmin();

  const username = s(formData, "username");
  const password = s(formData, "password");
  const invoiceCode = s(formData, "invoiceCode");
  const callbackUrl = s(formData, "callbackUrl");

  const errors: Record<string, string> = {};
  if (!username) errors.username = "Username шаардлагатай.";
  if (!password) errors.password = "Password шаардлагатай.";
  if (!invoiceCode) errors.invoiceCode = "Invoice code шаардлагатай.";

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

  const existing = await prisma.qPaySettings.findUnique({ where: { id: 1 } });
  const tokensToReset = existing && (
    existing.username !== username ||
    decryptSecret(existing.password) !== password ||
    existing.invoiceCode !== invoiceCode
  );

  await prisma.qPaySettings.upsert({
    where: { id: 1 },
    update: {
      username,
      password: encryptSecret(password),
      invoiceCode,
      callbackUrl: callbackUrl || null,
      // Шинэ creds бол хуучин token-уудыг хүчингүй болгоно
      ...(tokensToReset
        ? {
            accessToken: null,
            refreshToken: null,
            tokenExpiresAt: null,
            refreshTokenExpiresAt: null,
          }
        : {}),
    },
    create: {
      id: 1,
      username,
      password: encryptSecret(password),
      invoiceCode,
      callbackUrl: callbackUrl || null,
    },
  });

  revalidatePath("/system/qpay");
  return { ok: true, message: "QPay тохиргоо хадгалагдлаа." };
}
