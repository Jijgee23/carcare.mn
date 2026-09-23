// Contract — GET /api/v1/me/sessions (P8-B1)
//
// Auth: any authenticated user, acts on `auth.user.id` only.
// Query: page?, pageSize?/limit? (standard `parsePagination`, applies only
//   to the `ended` (revoked/expired) list — `active` is never paginated,
//   matching `lib/account/sessions.ts`'s `listAccountSessions` contract).
//   Unknown params rejected with 422 { error, code: "VALIDATION", fieldErrors }.
// Unified list per D-178: `UserSession` (web) + `RefreshToken` (mobile,
//   rotation-chain tip only), tagged `source`. `current: true` marks the
//   caller's own web session (via its cookie `sid` — not applicable to a
//   bearer-only caller) and/or its own mobile token (via
//   `auth.user.refreshTokenId`, D-180; null/absent for pre-D-180 tokens, so
//   no row is marked current in that case — same as never having a claim).
//
// 200: { active: AccountSessionDto[], ended: AccountSessionDto[],
//        otherActiveCount: number, pagination: PaginationMeta (for `ended`) }
// Errors: 401, 422 (VALIDATION)
//
// AccountSessionDto never carries tokenHash or any secret.

import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { listAccountSessions } from "@/lib/account/sessions";
import { parsePagination, rejectUnknownParams } from "@/lib/list-query-params";
import { buildMeta } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

const ALLOWED_PARAMS = ["page", "pageSize", "limit"] as const;

export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(req.url);

  const unknown = rejectUnknownParams(searchParams, ALLOWED_PARAMS);
  if (unknown) {
    return jsonError(422, unknown.message, {
      code: "VALIDATION",
      fieldErrors: { [unknown.field]: unknown.message },
    });
  }

  const paged = parsePagination(searchParams);
  if (typeof paged !== "object" || !("page" in paged)) {
    const err = paged as { field: string; message: string };
    return jsonError(422, err.message, { code: "VALIDATION", fieldErrors: { [err.field]: err.message } });
  }
  const { page, pageSize, skip, take } = paged;

  const result = await listAccountSessions(prisma, auth.user.id, {
    currentRefreshTokenId: auth.user.refreshTokenId ?? null,
    pagination: { skip, take },
  });

  return jsonOk({
    active: result.active,
    ended: result.ended,
    otherActiveCount: result.otherActiveCount,
    pagination: buildMeta(result.endedTotal, page, pageSize),
  });
}
