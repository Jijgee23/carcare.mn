"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  clearAccountSessionCookie,
  setAccountSessionCookie,
} from "@/lib/auth/account-cookies";
import { signAccountSession } from "@/lib/auth/account-session";
import { issuePhoneOtp, verifyPhoneOtp } from "@/lib/auth/otp";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { sendOtpSms } from "@/lib/sms";

export type AccountAuthState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  // 2-р шат (OTP оруулах) идэвхжсэн эсэх. Канон утсыг form-д буцааж барина.
  awaitingOtp?: boolean;
  phone?: string;
  name?: string;
} | null;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Эцсийн хэрэглэгчийн утсаар нэвтрэх — 2 шаттай:
 *   1) phone → OTP илгээх (awaitingOtp=true)
 *   2) phone + otpCode → баталгаажуулж Account resolve/create, session тогтооно.
 * Анхны нэвтрэлтэд `name` нэмж болно (заавал биш).
 */
export async function accountLoginAction(
  _prevState: AccountAuthState,
  formData: FormData,
): Promise<AccountAuthState> {
  const phone = normalizePhone(s(formData, "phone"));
  const otpCode = s(formData, "otpCode");
  const name = s(formData, "name");

  if (!phone) {
    return {
      ok: false,
      fieldErrors: { phone: "Зөв утасны дугаар оруулна уу." },
      name,
    };
  }

  const h = await headers();
  const ua = h.get("user-agent");
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;

  // --- 1-р шат: OTP илгээх ---
  if (!otpCode) {
    try {
      const { code } = await issuePhoneOtp({
        phone,
        type: "CONSUMER_LOGIN",
        userAgent: ua,
        ip,
      });
      const sent = await sendOtpSms(code, "CONSUMER_LOGIN", phone);
      if (!sent && process.env.NODE_ENV === "production") {
        return {
          ok: false,
          message: "Код илгээгдсэнгүй. Дараа дахин оролдоно уу.",
          phone,
          name,
        };
      }
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Код илгээхэд алдаа гарлаа.",
        phone,
        name,
      };
    }
    return {
      ok: false,
      awaitingOtp: true,
      phone,
      name,
      message: `${formatPhone(phone)} руу 6 оронтой код илгээлээ.`,
    };
  }

  // --- 2-р шат: OTP баталгаажуулах ---
  if (!/^\d{6}$/.test(otpCode)) {
    return {
      ok: false,
      awaitingOtp: true,
      phone,
      name,
      fieldErrors: { otpCode: "6 оронтой код оруулна уу." },
    };
  }

  const result = await verifyPhoneOtp({
    phone,
    type: "CONSUMER_LOGIN",
    code: otpCode,
  });
  if (!result.ok) {
    const message =
      result.reason === "expired"
        ? "Кодны хугацаа дууссан. Шинээр код авна уу."
        : result.reason === "too_many_attempts"
          ? "Хэт олон удаа буруу оролдсон. Шинээр код авна уу."
          : "Код буруу байна.";
    return {
      ok: false,
      awaitingOtp: true,
      phone,
      name,
      fieldErrors: { otpCode: message },
    };
  }

  // Account-ийг утсаар resolve / create. Хаагдсан бол нэвтрүүлэхгүй.
  let account = await prisma.account.findUnique({ where: { phone } });
  if (account && !account.isActive) {
    return {
      ok: false,
      awaitingOtp: true,
      phone,
      name,
      message: "Энэ дугаар түр хаагдсан байна.",
    };
  }
  if (!account) {
    account = await prisma.account.create({
      data: { phone, name: name || null, lastLoginAt: new Date() },
    });
  } else {
    account = await prisma.account.update({
      where: { id: account.id },
      data: {
        lastLoginAt: new Date(),
        // Нэр хоосон байсан үед анхны нэвтрэлтийн нэрээр бөглөнө.
        ...(name && !account.name ? { name } : {}),
      },
    });
  }

  const token = await signAccountSession({
    accountId: account.id,
    phone: account.phone,
  });
  await setAccountSessionCookie(token);

  redirect("/account");
}

/** Account-аас гарах. */
export async function accountSignOutAction(): Promise<void> {
  await clearAccountSessionCookie();
  redirect("/");
}
