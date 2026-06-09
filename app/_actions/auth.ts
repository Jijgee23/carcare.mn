"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  clearSessionCookie,
  setSessionCookie,
} from "@/lib/auth/cookies";
import { issueOtp, revokeAllOtps, verifyOtp } from "@/lib/auth/otp";
import { revokeAllForUser } from "@/lib/auth/refresh-token";
import { signSession } from "@/lib/auth/session";
import {
  createUserSession,
  revokeUserSession,
} from "@/lib/auth/user-session";
import { prisma } from "@/lib/prisma";
import { sendOtpSms } from "@/lib/sms";
import { saveUpload } from "@/lib/storage";
import { logAudit } from "@/lib/audit";
import { ALL_WEEKDAYS, DEFAULT_OPEN_DAYS } from "@/lib/branches";
import { trialEndDate } from "@/lib/subscription";
import { DEFAULT_UNITS } from "@/lib/units";

export type SignUpFormValues = {
  orgName: string;
  registerNumber: string;
  orgEmail: string;
  phone1: string;
  phone2: string;
  lastName: string;
  firstName: string;
  adminPhone: string;
  adminEmail: string;
};

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  awaitingOtp?: boolean;
  // Алдаа гарсан үед form-нд бөглөсөн утгуудыг буцааж сэргээхэд хэрэглэнэ.
  values?: SignUpFormValues;
} | null;

// ---- helpers --------------------------------------------------------------

function getStr(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function makeSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = randomBytes(3).toString("hex");
  return base ? `${base}-${suffix}` : suffix;
}

// ---- SIGN UP --------------------------------------------------------------

export async function signUpAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Organization
  const orgName = getStr(formData, "orgName");
  const registerNumber = getStr(formData, "registerNumber");
  const orgEmail = getStr(formData, "orgEmail");
  const phone1 = getStr(formData, "phone1");
  const phone2 = getStr(formData, "phone2");
  const logoFile = formData.get("logo");

  // Admin
  const lastName = getStr(formData, "lastName");
  const firstName = getStr(formData, "firstName");
  const adminPhone = getStr(formData, "adminPhone");
  const adminEmail = getStr(formData, "adminEmail");
  const password = getStr(formData, "password");
  const passwordConfirm = getStr(formData, "passwordConfirm");

  // OTP — хоёр дахь шатанд илгээгдэнэ
  const otpCode = getStr(formData, "otpCode");

  // Алдаа гарсан үед form-руу буцаах нэг удаагийн "values" snapshot
  const values: SignUpFormValues = {
    orgName,
    registerNumber,
    orgEmail,
    phone1,
    phone2,
    lastName,
    firstName,
    adminPhone,
    adminEmail,
  };

  const fieldErrors: Record<string, string> = {};

  if (!orgName) fieldErrors.orgName = "Байгууллагын нэрээ оруулна уу.";
  if (!/^\d{7}$/.test(registerNumber))
    fieldErrors.registerNumber = "Регистр яг 7 оронтой тоо байх ёстой.";
  if (!isEmail(orgEmail)) fieldErrors.orgEmail = "Байгууллагын Gmail буруу.";
  if (!phone1) fieldErrors.phone1 = "Утасны дугаар оруулна уу.";

  if (!lastName) fieldErrors.lastName = "Овгоо оруулна уу.";
  if (!firstName) fieldErrors.firstName = "Нэрээ оруулна уу.";
  if (!adminPhone) fieldErrors.adminPhone = "Утасны дугаар оруулна уу.";
  if (!isEmail(adminEmail)) fieldErrors.adminEmail = "Имэйл хаяг буруу.";
  if (password.length < 8)
    fieldErrors.password = "Нууц үг хамгийн багадаа 8 тэмдэгт байна.";
  if (password !== passwordConfirm)
    fieldErrors.passwordConfirm = "Нууц үг таарахгүй байна.";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors, values };
  }

  // --- 1-р шат: OTP илгээх ---
  // Дугаар / имэйл аль хэдийн бүртгэгдсэн эсэхийг урьдчилан шалгаж, дараа нь
  // SMS-ээр код илгээнэ.
  if (!otpCode) {
    const [tenantConflict, userConflict] = await Promise.all([
      prisma.tenant.findFirst({
        where: {
          OR: [{ registerNumber }, { email: orgEmail }],
        },
        select: { registerNumber: true, email: true },
      }),
      prisma.user.findUnique({
        where: { email: adminEmail },
        select: { id: true },
      }),
    ]);
    if (tenantConflict) {
      const fe: Record<string, string> = {};
      if (tenantConflict.registerNumber === registerNumber)
        fe.registerNumber = "Энэ регистр аль хэдийн бүртгэгдсэн байна.";
      if (tenantConflict.email === orgEmail)
        fe.orgEmail = "Энэ имэйл аль хэдийн бүртгэгдсэн байна.";
      return { ok: false, fieldErrors: fe, values };
    }
    if (userConflict) {
      return {
        ok: false,
        fieldErrors: {
          adminEmail: "Энэ имэйл хаяг аль хэдийн бүртгэгдсэн байна.",
        },
        values,
      };
    }

    const h = await headers();
    const ua = h.get("user-agent");
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      null;

    const { code } = await issueOtp({
      email: adminEmail,
      type: "SIGNUP",
      userAgent: ua,
      ip,
    });
    const sent = await sendOtpSms(code, "SIGNUP", adminPhone);
    if (!sent) {
      return {
        ok: false,
        message:
          "Баталгаажуулах код илгээгдсэнгүй. Утсаа шалгаж дахин оролдоно уу.",
        values,
      };
    }

    return {
      ok: false,
      awaitingOtp: true,
      message: `Утас ${adminPhone} руу 6 оронтой код илгээлээ. Кодоо оруулна уу.`,
      values,
    };
  }

  // --- 2-р шат: OTP баталгаажуулалт ---
  if (!/^\d{6}$/.test(otpCode)) {
    return {
      ok: false,
      awaitingOtp: true,
      fieldErrors: { otpCode: "6 оронтой код оруулна уу." },
      values,
    };
  }
  const otpResult = await verifyOtp({
    email: adminEmail,
    type: "SIGNUP",
    code: otpCode,
  });
  if (!otpResult.ok) {
    const message =
      otpResult.reason === "expired"
        ? "Кодны хугацаа дууссан. Шинээр код илгээнэ үү."
        : otpResult.reason === "too_many_attempts"
          ? "Хэт олон удаа буруу оролдсон. Шинээр код илгээнэ үү."
          : "Код буруу байна.";
    return {
      ok: false,
      awaitingOtp: true,
      fieldErrors: { otpCode: message },
      values,
    };
  }

  // Logo upload (заавал биш)
  let logoUrl: string | null = null;
  if (logoFile instanceof File && logoFile.size > 0) {
    try {
      const saved = await saveUpload(logoFile, "logos");
      logoUrl = saved.path;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Лого хадгалахад алдаа гарлаа.";
      return { ok: false, fieldErrors: { logo: msg }, values };
    }
  }

  // Transaction: Tenant + OWNER User
  let session;
  try {
    const passwordHash = await hashPassword(password);

    session = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug: makeSlug(orgName),
          name: orgName,
          registerNumber,
          email: orgEmail,
          phone1,
          phone2: phone2 || null,
          logoUrl,
        },
      });

      // Default нэгжүүд (ширхэг, цаг, мин, литр, кг, м, удаа, багц)
      await tx.unit.createMany({
        data: DEFAULT_UNITS.map((u) => ({
          tenantId: tenant.id,
          name: u.name,
          code: u.code,
        })),
        skipDuplicates: true,
      });

      // 14 хоногийн free trial subscription автоматаар үүсгэнэ
      const trialStart = new Date();
      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          plan: "FREE",
          status: "TRIAL",
          startsAt: trialStart,
          endsAt: trialEndDate(trialStart),
          notes: "Бүртгэлийн үед автоматаар үүсгэсэн 14 хоногийн туршилт.",
        },
      });

      // Үндсэн салбар үүсгэнэ — тенант бүртгэлийн утсыг өвлүүлнэ
      const branch = await tx.branch.create({
        data: {
          tenantId: tenant.id,
          name: "Үндсэн салбар",
          phone: phone1,
          isPrimary: true,
        },
      });

      // Долоо хоногийн 7 өдрийн default хуваарь (Даваа–Баасан нээлттэй)
      const defaultOpen = new Set(DEFAULT_OPEN_DAYS);
      await tx.branchSchedule.createMany({
        data: ALL_WEEKDAYS.map((wd) => ({
          branchId: branch.id,
          weekday: wd,
          isOpen: defaultOpen.has(wd),
        })),
      });

      const user = await tx.user.create({
        data: {
          email: adminEmail,
          firstName,
          lastName,
          phone: adminPhone,
          passwordHash,
          isOwner: true,
          tenantId: tenant.id,
          branchId: branch.id,
        },
      });

      return { userId: user.id, tenantId: tenant.id, isOwner: user.isOwner };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = (e.meta?.target as string[] | undefined)?.join(",") ?? "";
      const fe: Record<string, string> = {};
      if (target.includes("registerNumber"))
        fe.registerNumber = "Энэ регистр аль хэдийн бүртгэгдсэн байна.";
      else if (target.includes("Tenant_email") || target.includes("email") && target.includes("Tenant"))
        fe.orgEmail = "Энэ Gmail аль хэдийн бүртгэгдсэн байна.";
      else if (target.includes("User_email") || target.includes("email"))
        fe.adminEmail = "Энэ имэйл хаяг аль хэдийн бүртгэгдсэн байна.";
      else fe._ = "Давхардсан утга бүртгэгдсэн байна.";
      return { ok: false, fieldErrors: fe, values };
    }
    const msg = e instanceof Error ? e.message : "Бүртгэх явцад алдаа гарлаа.";
    return { ok: false, message: msg, values };
  }

  const token = await signSession(session);
  await setSessionCookie(token);
  redirect("/dashboard");
}

// ---- SIGN IN --------------------------------------------------------------

const MAX_LOGIN_ATTEMPTS = 5;

export async function signInAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = getStr(formData, "email").toLowerCase();
  const password = getStr(formData, "password");

  const fieldErrors: Record<string, string> = {};
  if (!isEmail(email)) fieldErrors.email = "Имэйл хаяг буруу.";
  if (!password) fieldErrors.password = "Нууц үгээ оруулна уу.";
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const user = await prisma.user.findUnique({
    where: { email },
    include: { tenant: { select: { suspended: true } } },
  });
  // Цаг алдалгүй "имэйл буруу" гэхгүй — нэвтрэгчдийг нэрлэх боломж өгөхгүй.
  if (!user) {
    return { ok: false, message: "Имэйл эсвэл нууц үг буруу байна." };
  }

  // Аккаунт түгжигдсэн бол энд л зогсоо.
  if (user.lockedAt) {
    return {
      ok: false,
      message:
        "Хэт олон удаа буруу оролдсон тул аккаунт түгжигдсэн. Нууц үгээ сэргээнэ үү.",
    };
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const nextAttempts = user.failedLoginAttempts + 1;
    const willLock = nextAttempts >= MAX_LOGIN_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: nextAttempts,
        lockedAt: willLock ? new Date() : undefined,
      },
    });
    if (willLock) {
      return {
        ok: false,
        message:
          "Хэт олон удаа буруу оролдсон тул аккаунт түгжигдсэн. Нууц үгээ сэргээнэ үү.",
      };
    }
    const remaining = MAX_LOGIN_ATTEMPTS - nextAttempts;
    return {
      ok: false,
      message: `Имэйл эсвэл нууц үг буруу байна. Үлдсэн оролдлого: ${remaining}.`,
    };
  }

  if (user.tenant.suspended) {
    return {
      ok: false,
      message:
        "Таны байгууллагын хандалт түр зогссон байна. carcare.mn-тай холбоо барина уу.",
    };
  }

  // Хэрэглэгчийн идэвхтэй эсэх / хугацаа дуусаагүй эсэхийг шалгах
  const { checkUserActive } = await import("@/lib/auth/active");
  const active = checkUserActive({
    isActive: user.isActive,
    activeUntil: user.activeUntil,
  });
  if (!active.ok) {
    return { ok: false, message: active.message };
  }

  // Амжилттай — алдааны тоологчийг тэглэх
  if (user.failedLoginAttempts > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedAt: null },
    });
  }

  // Web session-ийг DB-д бүртгэж (төхөөрөмж/түүх), JWT-д sid шигтгэнэ.
  const h = await headers();
  const ua = h.get("user-agent");
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;
  const session = await createUserSession({ userId: user.id, userAgent: ua, ip });

  const token = await signSession({
    userId: user.id,
    tenantId: user.tenantId,
    isOwner: user.isOwner,
    sid: session.id,
  });
  await setSessionCookie(token);

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "User",
    entityId: user.id,
    action: "LOGIN",
    summary: user.email,
  });

  redirect("/dashboard");
}

// ---- SIGN OUT -------------------------------------------------------------

export async function signOutAction(): Promise<void> {
  // Logout-аас өмнө хэрэглэгчийн мэдээллийг авна (cookie clear хийсний дараа танигдахгүй)
  try {
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (session) {
      // Энэ төхөөрөмжийн session-ийг revoke (идэвхтэй жагсаалтаас хасна).
      if (session.sid) {
        await revokeUserSession(session.sid, session.userId);
      }
      await logAudit({
        tenantId: session.tenantId,
        userId: session.userId,
        entity: "User",
        entityId: session.userId,
        action: "LOGOUT",
      });
    }
  } catch {
    // Аудит лог үндсэн logout-ийг тасалдуулахгүй
  }

  await clearSessionCookie();
  redirect("/page/login");
}

// ---- FORGOT PASSWORD ------------------------------------------------------

// Маск хийсэн утсыг харуулна — нийт цифрийн тоо мэдэгдэж эх дугаарыг бүгдийг
// харуулахгүй (security).
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D+/g, "");
  if (digits.length < 4) return digits.replace(/./g, "*");
  return `${"*".repeat(Math.max(0, digits.length - 2))}${digits.slice(-2)}`;
}

export type ForgotPasswordState = {
  ok: boolean;
  step: "request" | "verify";
  message?: string;
  fieldErrors?: Record<string, string>;
  email?: string;
  maskedPhone?: string;
} | null;

/**
 * 1-р шат: имэйл оруулаад, утсанд OTP илгээнэ.
 */
export async function requestPasswordResetAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = getStr(formData, "email").toLowerCase();
  if (!isEmail(email)) {
    return {
      ok: false,
      step: "request",
      fieldErrors: { email: "Имэйл хаяг буруу." },
    };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, phone: true },
  });

  // Хэрэглэгчийн нууцлалыг хадгалахын тулд бүх тохиолдолд success-тэй адил
  // хариу буцаана — гэхдээ OTP илгээх нь жинхэнэ хэрэглэгчийн хувьд л ажиллана.
  if (user) {
    const h = await headers();
    const ua = h.get("user-agent");
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      null;
    const { code } = await issueOtp({
      email,
      type: "RESET_PASSWORD",
      userId: user.id,
      userAgent: ua,
      ip,
    });
    await sendOtpSms(code, "RESET_PASSWORD", user.phone);
    return {
      ok: true,
      step: "verify",
      email,
      maskedPhone: maskPhone(user.phone),
      message: "Утсанд 6 оронтой код илгээлээ.",
    };
  }

  // Үл байгаа хэрэглэгчийг хүртэл "илгээсэн" гэж харуулна (enumeration-аас сэргийлнэ)
  return {
    ok: true,
    step: "verify",
    email,
    maskedPhone: "**",
    message: "Хэрэв энэ имэйл бүртгэлтэй бол утсанд код илгээгдсэн.",
  };
}

/**
 * 2-р шат: OTP + шинэ нууц үг. Амжилттай үед бүх refresh token + OTP-уудыг
 * revoke хийгээд аккаунтыг unlock хийнэ.
 */
export async function resetPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = getStr(formData, "email").toLowerCase();
  const code = getStr(formData, "code");
  const password = getStr(formData, "password");
  const passwordConfirm = getStr(formData, "passwordConfirm");

  const fieldErrors: Record<string, string> = {};
  if (!isEmail(email)) fieldErrors.email = "Имэйл хаяг буруу.";
  if (!/^\d{6}$/.test(code))
    fieldErrors.code = "6 оронтой код оруулна уу.";
  if (password.length < 8)
    fieldErrors.password = "Нууц үг хамгийн багадаа 8 тэмдэгт байна.";
  if (password !== passwordConfirm)
    fieldErrors.passwordConfirm = "Нууц үг таарахгүй байна.";
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, step: "verify", email, fieldErrors };
  }

  const otp = await verifyOtp({ email, type: "RESET_PASSWORD", code });
  if (!otp.ok) {
    const message =
      otp.reason === "expired"
        ? "Кодны хугацаа дууссан. Шинээр код илгээнэ үү."
        : otp.reason === "too_many_attempts"
          ? "Хэт олон удаа буруу оролдсон. Шинээр код илгээнэ үү."
          : "Код буруу байна.";
    return { ok: false, step: "verify", email, fieldErrors: { code: message } };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    return {
      ok: false,
      step: "verify",
      email,
      message: "Хэрэглэгч олдсонгүй.",
    };
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      failedLoginAttempts: 0,
      lockedAt: null,
    },
  });
  // Бүх идэвхтэй refresh token-уудыг хүчингүй болгож, бусад OTP-уудыг ч revoke
  await Promise.all([
    revokeAllForUser(user.id),
    revokeAllOtps(email, "RESET_PASSWORD"),
  ]);

  return {
    ok: true,
    step: "verify",
    email,
    message: "Нууц үг шинэчлэгдлээ. Шинэ нууц үгээрээ нэвтэрнэ үү.",
  };
}
