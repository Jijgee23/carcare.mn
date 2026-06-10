import { NextResponse } from "next/server";
import { type ApiUser, getApiUserFromRequest } from "@/lib/auth/api-token";
import type { PermissionCode } from "@/lib/auth/permissions";
import { hasPermission } from "@/lib/auth/roles";
import { clientIp, consumeRateLimit } from "@/lib/rate-limit";

export function jsonError(status: number, message: string, extra?: object) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

/**
 * Эрх дутсан үед буцаах 403. `requirePermission` дотроос болон route-уудаас
 * шууд хэрэглэж болно.
 */

export function jsonForbidden(
  message = "Танд энэ үйлдэл хийх эрх байхгүй.",
): NextResponse {
  return jsonError(403, message);
}

/**
 * Authenticated ApiUser тухайн permission-той эсэхийг шалгана. Эрхгүй бол 403
 * Response-г буцаана (route дотор `if (resp) return resp;`), эрхтэй бол null.
 *
 * Жишээ:
 *   const auth = await requireApiUser(req);
 *   if (auth.response) return auth.response;
 *   const denied = requirePermission(auth.user, "orders.create");
 *   if (denied) return denied;
 */

export function requirePermission(
  user: ApiUser,
  code: PermissionCode,
): NextResponse | null {
  return hasPermission(user, code) ? null : jsonForbidden();
}

/**
 * Route handler-уудад хэрэглэх — token шалгаж user-г буцаана.
 * Token байхгүй/буруу бол Response-г шууд буцаана (early return).
 */
export async function requireApiUser(
  req: Request,
): Promise<{ user: ApiUser; response?: undefined } | { user?: undefined; response: NextResponse }> {
  const user = await getApiUserFromRequest(req);
  if (!user) {
    return {
      response: jsonError(401, "Нэвтрэх шаардлагатай эсвэл token хүчингүй."),
    };
  }
  return { user };
}

/**
 * Route-д rate limit мөрдүүлнэ. Лимит хэтэрвэл 429 Response, эс бөгөөс null.
 * `id` өгвөл түүгээр (ж: userId), үгүй бол клиентийн IP-аар bucket хийнэ.
 *
 *   const limited = enforceRateLimit(req, "api-login", { limit: 10, windowMs: 60_000 });
 *   if (limited) return limited;
 */
export function enforceRateLimit(
  req: Request,
  bucket: string,
  opts: { limit: number; windowMs: number },
  id?: string,
): NextResponse | null {
  const key = `${bucket}:${id ?? clientIp(req)}`;
  const result = consumeRateLimit(key, opts);
  if (result.ok) return null;
  return NextResponse.json(
    { error: "Хэт олон хүсэлт илгээлээ. Түр хүлээгээд дахин оролдоно уу." },
    { status: 429, headers: { "retry-after": String(result.retryAfterSec) } },
  );
}

export function methodNotAllowed(allowed: string[]) {
  return new NextResponse(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: {
      "content-type": "application/json",
      allow: allowed.join(", "),
    },
  });
}
