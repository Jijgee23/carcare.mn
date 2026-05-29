"use server";

import { redirect } from "next/navigation";
import { verifyPassword } from "@/lib/auth/password";
import {
  clearSystemSessionCookie,
  setSystemSessionCookie,
} from "@/lib/auth/system-cookies";
import { signSystemSession } from "@/lib/auth/system-session";
import { prisma } from "@/lib/prisma";

export type SystemActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  // Submit алдсан үед оруулсан утгуудыг хадгалж form-руу буцаана.
  // React 19-ийн form action нь автоматаар reset хийдэг тул defaultValue-р
  // дамжуулан утгыг сэргээх шаардлагатай.
  values?: { email?: string };
} | null;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function signInSystemAction(
  _prev: SystemActionState,
  formData: FormData,
): Promise<SystemActionState> {
  const email = s(formData, "email");
  const password = s(formData, "password");

  const fieldErrors: Record<string, string> = {};
  if (!isEmail(email)) fieldErrors.email = "Имэйл буруу.";
  if (!password) fieldErrors.password = "Нууц үгээ оруулна уу.";
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors, values: { email } };
  }

  const admin = await prisma.superAdmin.findUnique({ where: { email } });
  if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
    return {
      ok: false,
      message: "Имэйл эсвэл нууц үг буруу.",
      values: { email },
    };
  }

  const token = await signSystemSession({
    adminId: admin.id,
    email: admin.email,
  });
  await setSystemSessionCookie(token);
  redirect("/system");
}

export async function signOutSystemAction(): Promise<void> {
  await clearSystemSessionCookie();
  redirect("/system/login");
}
