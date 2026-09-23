// Contract — POST /api/v1/me/sessions/revoke-others (P8-B1)
//
// Auth: any authenticated user, acts on `auth.user.id` only.
// Revokes every other active UserSession and RefreshToken for the caller,
// keeping only this bearer's own mobile token alive (identified via
// `auth.user.refreshTokenId`, D-180). No body. If the bearer token predates
// D-180 (no `rtid` claim), `currentRefreshTokenId` is null and ALL mobile
// tokens — including the one just used — are revoked; the client should
// expect its next request to 401 and re-authenticate. There is no web
// `currentSessionId` in an API-only call, so every `UserSession` is revoked.
//
// 200: { ok: true, webRevoked: number, mobileRevoked: number }
// Errors: 401

import { jsonOk, requireApiUser } from "@/lib/api";
import { revokeOtherAccountSessions } from "@/lib/account/sessions";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const { webRevoked, mobileRevoked } = await revokeOtherAccountSessions(
    prisma,
    auth.user.id,
    { currentRefreshTokenId: auth.user.refreshTokenId ?? null },
  );

  return jsonOk({ ok: true, webRevoked, mobileRevoked });
}
