/**
 * Мобайл клиентэд зориулсан refresh token. Опак (random байт), DB-д
 * sha256 hex хэлбэрээр хадгална. Login үед issue, /api/v1/auth/refresh
 * үед rotate (хуучин зэрэг revoke), logout үед revoke хийнэ.
 */

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 60 хоног

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function generateRaw(): string {
  // 32 байт ~= 43 тэмдэгт base64url
  return randomBytes(32).toString("base64url");
}

export type IssueRefreshOptions = {
  userId: string;
  userAgent?: string | null;
  ip?: string | null;
};

export async function issueRefreshToken(
  opts: IssueRefreshOptions,
): Promise<{ token: string; expiresAt: Date }> {
  const raw = generateRaw();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_SECONDS * 1000);

  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId: opts.userId,
      userAgent: opts.userAgent ?? null,
      ip: opts.ip ?? null,
      expiresAt,
    },
  });

  return { token: raw, expiresAt };
}

/**
 * Refresh token-ыг шалгаад rotate хийнэ — хуучныг revoke-олж шинэ token
 * үүсгэж буцаана. Token хэт хуучирсан, revoke-олсон эсвэл олдохгүй бол null.
 *
 * Anti-reuse: хэрвээ revoke-олсон token-ыг ахин хэрэглэвэл бүх токеныг хүчингүй
 * болгож, аюулгүй байдлын эсрэг үйлдэл гэж үзнэ.
 */
export async function rotateRefreshToken(
  rawToken: string,
  opts: { userAgent?: string | null; ip?: string | null } = {},
): Promise<
  | { ok: true; token: string; expiresAt: Date; userId: string }
  | { ok: false; reason: "invalid" | "expired" | "reused" }
> {
  const tokenHash = hashToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      revokedAt: true,
    },
  });
  if (!existing) return { ok: false, reason: "invalid" };

  if (existing.revokedAt) {
    // Хуучин revoke-олсон token хэрэглэгдсэн — энэ хэрэглэгчийн бүх token-ыг revoke
    await prisma.refreshToken.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: false, reason: "reused" };
  }

  if (existing.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const newRaw = generateRaw();
  const newHash = hashToken(newRaw);
  const newExpiresAt = new Date(
    Date.now() + REFRESH_TOKEN_MAX_AGE_SECONDS * 1000,
  );

  // Хуучнаа revoke + шинийг үүсгэх атомт
  await prisma.$transaction(async (tx) => {
    const newRow = await tx.refreshToken.create({
      data: {
        tokenHash: newHash,
        userId: existing.userId,
        userAgent: opts.userAgent ?? null,
        ip: opts.ip ?? null,
        expiresAt: newExpiresAt,
      },
      select: { id: true },
    });
    await tx.refreshToken.update({
      where: { id: existing.id },
      data: {
        revokedAt: new Date(),
        lastUsedAt: new Date(),
        replacedById: newRow.id,
      },
    });
  });

  return {
    ok: true,
    token: newRaw,
    expiresAt: newExpiresAt,
    userId: existing.userId,
  };
}

/**
 * Тухайн token-ыг revoke. Олдохгүй ч false-г буцаахгүй (idempotent).
 */
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Хэрэглэгчийн бүх идэвхтэй token-ыг revoke (нууц үг солих, "бүх төхөөрөмжөөс
 * гарах" гэх мэт хувилбарт).
 */
export async function revokeAllForUser(userId: string): Promise<number> {
  const r = await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return r.count;
}
