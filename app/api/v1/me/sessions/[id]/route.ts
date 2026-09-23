// Contract — DELETE /api/v1/me/sessions/[id] (P8-B1)
//
// Auth: any authenticated user, acts on `auth.user.id` only.
// `[id]` addresses a row in either `UserSession` (web) or `RefreshToken`
// (mobile) — the two tables can in theory collide on id (`lib/account/
// sessions.ts`'s note), so the row must always be addressed as (source, id)
// together. This route picks the **query-param form**:
//   DELETE /api/v1/me/sessions/{id}?source=web|mobile
// `source` is REQUIRED and must be exactly "web" or "mobile" — there is no
// default, unlike the web `revokeSessionAction` (which defaults to "web"
// because its form always sets the field); an API caller must be explicit
// since either table could hold that id.
//
// A row that does not exist, belongs to another user, or is already ended
// still returns 200 (idempotent), matching `revokeAccountSession`'s
// semantics — EXCEPT a row that never existed for this user at all (checked
// via `lib/account/sessions.ts`'s `findUnique` + ownership check) returns
// 404, per the phase invariant ("a session or token id belonging to another
// user returns 404"). Revoking the caller's OWN current mobile token
// succeeds (200) — the client is expected to log out locally afterward.
//
// 200: { ok: true }
// Errors: 401, 404 (NOT_FOUND, foreign/missing id), 422 (VALIDATION, missing
// or invalid `source`)

import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import {
  revokeAccountSession,
  type AccountSessionSource,
} from "@/lib/account/sessions";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const { searchParams } = new URL(req.url);
  const rawSource = searchParams.get("source");
  if (rawSource !== "web" && rawSource !== "mobile") {
    return jsonError(422, "source нь web эсвэл mobile байх ёстой.", {
      code: "VALIDATION",
      fieldErrors: { source: "source нь web эсвэл mobile байх ёстой." },
    });
  }
  const source: AccountSessionSource = rawSource;

  const result = await revokeAccountSession(prisma, auth.user.id, source, id);
  if (!result.ok) {
    return jsonError(404, "Олдсонгүй.", { code: "NOT_FOUND" });
  }

  return jsonOk({ ok: true });
}
