// P8-B0 — password-change validation and update, extracted from
// `app/_actions/profile.ts`'s `changePasswordAction` so the web server action
// and the future `POST /api/v1/me/password` route (P8-B1) share one core.
// Framework-free: no `"use server"`, cookies, `Request`, or `logAudit` here
// (mirrors `lib/employees/core.ts` — the audit call stays in the action
// wrapper after the core succeeds) so this file works against an in-memory
// fake client in tests.
// Messages are byte-identical to the pre-extraction action.
//
// D-179: on success, revoke every OTHER active UserSession and RefreshToken
// for the user (keep the caller's own, if given), via `revokedAt` — never
// delete — alongside the password-hash update, in one transaction.
// D-181: failed current-password attempts are rate-limited with the same
// primitive the login route uses (`consumeRateLimit`), 5 per 15 minutes,
// keyed per user id. A successful attempt never consumes the budget.

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { consumeRateLimit } from "@/lib/rate-limit";
import type { AccountClient } from "./types";

export type PasswordActor = { id: string; tenantId: string; passwordHash: string | null };

export type PasswordInput = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

/** Дуудагчийн одоогийн session/refresh token — устгахгүй үлдээнэ. */
export type PasswordChangeContext = {
  currentSessionId?: string | null;
  currentRefreshTokenId?: string | null;
};

export type PasswordResult =
  | { ok: true }
  | { ok: false; fieldErrors?: Record<string, string>; message?: string; code?: "RATE_LIMITED" };

export const PASSWORD_RATE_LIMIT_BUCKET = "account-password";
export const PASSWORD_RATE_LIMIT_MAX_ATTEMPTS = 5;
export const PASSWORD_RATE_LIMIT_WINDOW_MS = 15 * 60_000;

// login route-той нэг зарчмаар (429 биш — action/route context-д зориулж
// code/message хэлбэрээр буцаана, HTTP статусыг caller (route) шийднэ).
const RATE_LIMITED_MESSAGE =
  "Хэт олон удаа буруу оролдсон тул түр хугацаагаар хориглогдлоо. 15 минутын дараа дахин оролдоно уу.";

/**
 * Нууц үг солих. Одоогийн нууц үг зөв байх ёстой (fail тутамд rate-limit
 * тоологдоно), шинэ нь 8+ тэмдэгт, confirm-тай таарч, өмнөхөөс өөр байх
 * ёстой. Амжилттай бол hash шинэчлэгдэж, D-179-ийн дагуу бусад бүх
 * session/refresh token revoke хийгдэнэ (нэг transaction дотор).
 */
export async function changePassword(
  db: AccountClient,
  actor: PasswordActor,
  input: PasswordInput,
  ctx: PasswordChangeContext = {},
): Promise<PasswordResult> {
  const current = input.currentPassword;
  const next = input.newPassword;
  const confirm = input.confirmPassword;

  const fieldErrors: Record<string, string> = {};
  if (!current) fieldErrors.currentPassword = "Одоогийн нууц үгээ оруулна уу.";
  if (next.length < 8) fieldErrors.newPassword = "Шинэ нууц үг 8+ тэмдэгт байна.";
  if (next !== confirm) fieldErrors.confirmPassword = "Нууц үг таарахгүй байна.";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  // Идэвхжээгүй (нууц үггүй) ажилтан энд хүрэхгүй — гэхдээ типийн хувьд хамгаална.
  if (!actor.passwordHash) {
    return {
      ok: false,
      message: "Аккаунт идэвхжээгүй байна. Эхлээд нууц үгээ үүсгэнэ үү.",
    };
  }

  const ok = await verifyPassword(current, actor.passwordHash);
  if (!ok) {
    const limited = consumeRateLimit(`${PASSWORD_RATE_LIMIT_BUCKET}:${actor.id}`, {
      limit: PASSWORD_RATE_LIMIT_MAX_ATTEMPTS,
      windowMs: PASSWORD_RATE_LIMIT_WINDOW_MS,
    });
    if (!limited.ok) {
      return { ok: false, code: "RATE_LIMITED", message: RATE_LIMITED_MESSAGE };
    }
    return {
      ok: false,
      fieldErrors: { currentPassword: "Одоогийн нууц үг буруу." },
    };
  }

  if (await verifyPassword(next, actor.passwordHash)) {
    return {
      ok: false,
      fieldErrors: { newPassword: "Шинэ нууц үг өмнөхөөс өөр байх ёстой." },
    };
  }

  const newHash = await hashPassword(next);

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: actor.id },
      data: { passwordHash: newHash },
    });
    await tx.userSession.updateMany({
      where: {
        userId: actor.id,
        revokedAt: null,
        ...(ctx.currentSessionId ? { id: { not: ctx.currentSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    await tx.refreshToken.updateMany({
      where: {
        userId: actor.id,
        revokedAt: null,
        ...(ctx.currentRefreshTokenId ? { id: { not: ctx.currentRefreshTokenId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
  });

  return { ok: true };
}
