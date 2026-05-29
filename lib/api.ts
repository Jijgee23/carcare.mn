import { NextResponse } from "next/server";
import { type ApiUser, getApiUserFromRequest } from "@/lib/auth/api-token";

export function jsonError(status: number, message: string, extra?: object) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
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

export function methodNotAllowed(allowed: string[]) {
  return new NextResponse(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: {
      "content-type": "application/json",
      allow: allowed.join(", "),
    },
  });
}
