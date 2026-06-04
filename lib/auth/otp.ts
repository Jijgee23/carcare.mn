/**
 * OTP — 6 оронтой нэг удаагийн код. Signup, нууц үг солих/сэргээх үед хэрэглэнэ.
 *
 * Аюулгүй байдлын зарчмууд:
 *  - Раw кодыг DB-д хадгалахгүй (sha256 hex).
 *  - issueOtp() үед тухайн (email, type)-ийн өмнөх consumed биш бүх OTP-ийг
 *    revoke хийнэ ("invalidate previous").
 *  - verifyOtp() буруу баталгаажуулалт бүрт `attempts` нэмж, 5 болсон үед
 *    OTP-ийг хүчингүй болгоно (brute force-аас сэргийлнэ).
 *  - Хугацаа дуусгавар нь 10 минут.
 */

import { createHash, randomInt } from "node:crypto";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";

// OTP issuance throttle — SMS bombing / cost abuse-аас сэргийлнэ.
const OTP_ISSUE_WINDOW_MS = 10 * 60_000; // 10 минут
const OTP_MAX_PER_EMAIL = 3; // нэг имэйл+төрөлд 10 минутад
const OTP_MAX_PER_IP = 10; // нэг IP-аас 10 минутад

export type OtpType = "SIGNUP" | "CHANGE_PASSWORD" | "RESET_PASSWORD";

export const OTP_CODE_LENGTH = 6;
export const OTP_MAX_AGE_SECONDS = 60 * 10; // 10 минут
export const OTP_MAX_ATTEMPTS = 5;

function hashCode(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function generateCode(): string {
  // 0-999999 хооронд, 6 оронтой паддингтай
  const n = randomInt(0, 1_000_000);
  return n.toString().padStart(OTP_CODE_LENGTH, "0");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// --- Dev-only OTP харагдац ------------------------------------------------
// DB-д зөвхөн codeHash (sha256) хадгалагддаг тул raw кодыг харуулах боломжгүй.
// Хөгжүүлэлтэд SMS-гүйгээр нэвтрэхэд тусдаа raw кодыг санах ойд (DB БИШ) барьж,
// /system/otp хуудсанд харуулна. Production-д ХЭЗЭЭ Ч бичигдэхгүй / хадгалагдахгүй.

export type DevOtpEntry = {
  email: string;
  type: OtpType;
  code: string;
  createdAt: Date;
  expiresAt: Date;
};

const DEV_OTP_LIMIT = 50;
const devOtpHolder = globalThis as unknown as {
  __carcareDevOtps?: DevOtpEntry[];
};

function recordDevOtp(entry: DevOtpEntry): void {
  if (process.env.NODE_ENV === "production") return;
  const list =
    devOtpHolder.__carcareDevOtps ?? (devOtpHolder.__carcareDevOtps = []);
  list.push(entry);
  if (list.length > DEV_OTP_LIMIT) list.splice(0, list.length - DEV_OTP_LIMIT);
}

/** Хөгжүүлэлтэд үүсгэсэн OTP кодуудын жагсаалт (шинэ нь эхэнд). Prod-д хоосон. */
export function getDevOtps(): DevOtpEntry[] {
  if (process.env.NODE_ENV === "production") return [];
  return [...(devOtpHolder.__carcareDevOtps ?? [])].reverse();
}

export type IssueOtpOptions = {
  email: string;
  type: OtpType;
  userId?: string | null;
  userAgent?: string | null;
  ip?: string | null;
};

/**
 * Шинэ OTP үүсгэж, раw кодыг буцаана (имэйл илгээгчид зориулсан).
 * Өмнөх consumed биш бүх OTP-уудыг хүчингүй болгоно.
 */
export async function issueOtp(
  opts: IssueOtpOptions,
): Promise<{ code: string; expiresAt: Date }> {
  const email = normalizeEmail(opts.email);
  if (!email) throw new Error("Имэйл хоосон байж болохгүй.");

  // Хэт олон код хүсэхээс сэргийлнэ (имэйл+төрөл, мөн боломжтой бол IP-аар).
  const byEmail = consumeRateLimit(`otp:${opts.type}:${email}`, {
    limit: OTP_MAX_PER_EMAIL,
    windowMs: OTP_ISSUE_WINDOW_MS,
  });
  if (!byEmail.ok) {
    throw new Error(
      `Хэт олон код хүслээ. ${Math.ceil(byEmail.retryAfterSec / 60)} минутын дараа дахин оролдоно уу.`,
    );
  }
  if (opts.ip) {
    const byIp = consumeRateLimit(`otp-ip:${opts.ip}`, {
      limit: OTP_MAX_PER_IP,
      windowMs: OTP_ISSUE_WINDOW_MS,
    });
    if (!byIp.ok) {
      throw new Error(
        `Хэт олон код хүслээ. ${Math.ceil(byIp.retryAfterSec / 60)} минутын дараа дахин оролдоно уу.`,
      );
    }
  }

  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + OTP_MAX_AGE_SECONDS * 1000);

  // Хөгжүүлэлтэд SMS хүргэхгүй / хүрэхгүй байж болзошгүй тул кодыг сервер
  // console + /system/otp хуудсанд харуулна. Production-д ХЭЗЭЭ Ч хийхгүй.
  if (process.env.NODE_ENV !== "production") {
    recordDevOtp({ email, type: opts.type, code, createdAt: new Date(), expiresAt });
    console.info(`\n🔑 [OTP] ${opts.type} · ${email} → ${code}\n`);
  }

  await prisma.$transaction(async (tx) => {
    // Өмнөх идэвхтэй OTP-уудыг хүчингүй болго (зөвхөн хамгийн сүүлийн нь л зөв)
    await tx.otp.updateMany({
      where: {
        email,
        type: opts.type,
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });

    await tx.otp.create({
      data: {
        email,
        codeHash,
        type: opts.type,
        userId: opts.userId ?? null,
        userAgent: opts.userAgent ?? null,
        ip: opts.ip ?? null,
        expiresAt,
      },
    });
  });

  return { code, expiresAt };
}

export type VerifyOtpResult =
  | { ok: true; otpId: string; userId: string | null }
  | { ok: false; reason: "invalid" | "expired" | "consumed" | "too_many_attempts" };

/**
 * OTP-г баталгаажуулна. Зөв тохиолдолд `consumedAt`-г тогтоож дахин ашиглахгүй.
 * Буруу үед `attempts` нэмнэ. OTP_MAX_ATTEMPTS-аас давсан үед OTP-г хаалт хийнэ.
 */
export async function verifyOtp(input: {
  email: string;
  type: OtpType;
  code: string;
}): Promise<VerifyOtpResult> {
  const email = normalizeEmail(input.email);
  const code = (input.code ?? "").trim();
  if (!email || !/^\d{6}$/.test(code)) {
    return { ok: false, reason: "invalid" };
  }
  const codeHash = hashCode(code);

  // Хамгийн сүүлийн consumed биш OTP-ийг авна
  const otp = await prisma.otp.findFirst({
    where: { email, type: input.type, consumedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      codeHash: true,
      attempts: true,
      expiresAt: true,
      userId: true,
    },
  });
  if (!otp) return { ok: false, reason: "invalid" };

  if (otp.expiresAt.getTime() <= Date.now()) {
    await prisma.otp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });
    return { ok: false, reason: "expired" };
  }

  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    await prisma.otp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });
    return { ok: false, reason: "too_many_attempts" };
  }

  if (otp.codeHash !== codeHash) {
    await prisma.otp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "invalid" };
  }

  // Зөв — consume
  await prisma.otp.update({
    where: { id: otp.id },
    data: { consumedAt: new Date() },
  });
  return { ok: true, otpId: otp.id, userId: otp.userId };
}

/**
 * Хэрэглэгчийн бүх consumed биш OTP-уудыг цуцлана (нууц үг солисны дараа г.м.).
 */
export async function revokeAllOtps(
  email: string,
  type?: OtpType,
): Promise<number> {
  const where: Prisma.OtpWhereInput = {
    email: normalizeEmail(email),
    consumedAt: null,
  };
  if (type) where.type = type;
  const r = await prisma.otp.updateMany({
    where,
    data: { consumedAt: new Date() },
  });
  return r.count;
}
