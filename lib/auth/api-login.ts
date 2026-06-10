/**
 * Мобайл API-ийн нэвтрэлт амжилттай болсон үед буцаах хариу (access + refresh
 * token + хэрэглэгчийн мэдээлэл). Нууц үгээр нэвтрэх (`/auth/login`) болон
 * аккаунт идэвхжүүлэх (`/auth/activate`) хоёул ижил payload буцаахын тулд энд
 * нэгтгэв — хоёр газар салангид бичигдэж зөрөхөөс сэргийлнэ.
 */

import {
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  signApiToken,
} from "@/lib/auth/api-token";
import {
  REFRESH_TOKEN_MAX_AGE_SECONDS,
  issueRefreshToken,
} from "@/lib/auth/refresh-token";

export type ApiLoginUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  isOwner: boolean;
  tenantId: string;
  branchId: string | null;
  tenant: { id: string; name: string };
  role: { id: string; name: string; permissions: unknown } | null;
};

function requestMeta(req: Request): {
  userAgent: string | null;
  ip: string | null;
} {
  const userAgent = req.headers.get("user-agent");
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  return { userAgent, ip };
}

/**
 * Access token (богино настай) + refresh token (DB-д бүртгэгдсэн) үүсгэж,
 * клиентэд буцаах JSON объектыг бүрдүүлнэ.
 */
export async function buildApiLoginResponse(
  user: ApiLoginUser,
  req: Request,
): Promise<Record<string, unknown>> {
  const accessToken = await signApiToken({
    userId: user.id,
    tenantId: user.tenantId,
    isOwner: user.isOwner,
  });

  const { userAgent, ip } = requestMeta(req);
  const { token: refreshToken, expiresAt: refreshExpiresAt } =
    await issueRefreshToken({ userId: user.id, userAgent, ip });

  return {
    accessToken,
    accessTokenExpiresInSeconds: ACCESS_TOKEN_MAX_AGE_SECONDS,
    // Backwards-compat alias
    expiresInSeconds: ACCESS_TOKEN_MAX_AGE_SECONDS,
    refreshToken,
    refreshTokenExpiresInSeconds: REFRESH_TOKEN_MAX_AGE_SECONDS,
    refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      isOwner: user.isOwner,
      role: user.role
        ? {
            id: user.role.id,
            name: user.role.name,
            permissions: user.role.permissions,
          }
        : null,
      branchId: user.branchId,
      tenant: { id: user.tenant.id, name: user.tenant.name },
    },
  };
}
