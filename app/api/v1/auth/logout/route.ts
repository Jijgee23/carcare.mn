import { jsonError, jsonOk } from "@/lib/api";
import { revokeRefreshToken } from "@/lib/auth/refresh-token";

/**
 * POST /api/v1/auth/logout
 * Body: { refreshToken: string }
 *
 * Тухайн refresh token-ыг revoke. Access token нь өөрөө богино настай тул
 * эргэлзэхгүйгээр expire-руу үлдэнэ.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Body нь JSON байх ёстой.");
  }

  if (!body || typeof body !== "object") {
    return jsonError(400, "refreshToken шаардлагатай.");
  }
  const { refreshToken } = body as { refreshToken?: unknown };
  if (typeof refreshToken !== "string" || !refreshToken.trim()) {
    return jsonError(400, "refreshToken-ийг текстээр илгээнэ үү.");
  }

  await revokeRefreshToken(refreshToken.trim());
  return jsonOk({ ok: true });
}
