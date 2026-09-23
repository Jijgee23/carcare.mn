// Contract — POST /api/v1/me/password (P8-B1)
//
// Auth: any authenticated user, acts on `auth.user.id` only.
// Body (JSON): { currentPassword, newPassword, confirmPassword }.
// Delegates to `lib/account/password.ts`'s `changePassword` — same
// validation, current-password check, D-181 rate limit (5 failed attempts /
// 15 min / user) and D-179 revocation (all other UserSessions + RefreshTokens
// revoked, this device's `auth.user.refreshTokenId` kept alive per D-180) as
// `changePasswordAction`. The web `currentSessionId` concept has no mobile
// analogue here — only `currentRefreshTokenId` is passed, so a mobile-only
// caller keeps exactly this token; if a bearer token lacks the `rtid` claim
// (issued before D-180), all refresh tokens are revoked, same as before.
//
// 200: { ok: true }
// Errors: 400 (bad JSON), 401, 422 { error, code: "VALIDATION", fieldErrors },
// 429 { error, code: "RATE_LIMITED" }
//
// Never returns passwordHash, tokenHash or a raw token.

import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { changePassword } from "@/lib/account/password";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Body нь JSON байх ёстой.");
  }
  if (!body || typeof body !== "object") {
    return jsonError(400, "currentPassword, newPassword, confirmPassword шаардлагатай.");
  }
  const { currentPassword, newPassword, confirmPassword } = body as Record<string, unknown>;
  const toStr = (v: unknown) => (typeof v === "string" ? v : "");

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { passwordHash: true },
  });
  if (!user) return jsonError(401, "Хэрэглэгч олдсонгүй.");

  const result = await changePassword(
    prisma,
    { id: auth.user.id, tenantId: auth.user.tenantId, passwordHash: user.passwordHash },
    {
      currentPassword: toStr(currentPassword),
      newPassword: toStr(newPassword),
      confirmPassword: toStr(confirmPassword),
    },
    { currentRefreshTokenId: auth.user.refreshTokenId ?? null },
  );

  if (!result.ok) {
    if (result.code === "RATE_LIMITED") {
      return jsonError(429, result.message ?? "Хэт олон удаа буруу оролдлоо.", {
        code: "RATE_LIMITED",
      });
    }
    if (result.fieldErrors) {
      return jsonError(422, "Талбарын алдаа.", {
        code: "VALIDATION",
        fieldErrors: result.fieldErrors,
      });
    }
    return jsonError(422, result.message ?? "Алдаа гарлаа.", { code: "VALIDATION" });
  }

  await logAudit({
    tenantId: auth.user.tenantId,
    userId: auth.user.id,
    entity: "User",
    entityId: auth.user.id,
    action: "UPDATE",
    summary: "Нууц үг солив",
  });

  return jsonOk({ ok: true });
}
