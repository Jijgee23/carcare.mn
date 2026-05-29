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

  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + OTP_MAX_AGE_SECONDS * 1000);

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
