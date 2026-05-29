import { jsonError, jsonOk } from "@/lib/api";
import {
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  signApiToken,
} from "@/lib/auth/api-token";
import { verifyPassword } from "@/lib/auth/password";
import {
  REFRESH_TOKEN_MAX_AGE_SECONDS,
  issueRefreshToken,
} from "@/lib/auth/refresh-token";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Body нь JSON байх ёстой.");
  }

  if (!body || typeof body !== "object") {
    return jsonError(400, "Email, нууц үг шаардлагатай.");
  }
  const { email, password } = body as { email?: unknown; password?: unknown };

  if (typeof email !== "string" || typeof password !== "string") {
    return jsonError(400, "Email, нууц үгийг текстээр илгээнэ үү.");
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return jsonError(400, "Email, нууц үг хоосон байж болохгүй.");
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      tenant: { select: { id: true, name: true, suspended: true } },
      role: { select: { id: true, name: true, permissions: true } },
    },
  });
  if (!user) return jsonError(401, "Имэйл эсвэл нууц үг буруу.");

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return jsonError(401, "Имэйл эсвэл нууц үг буруу.");

  if (user.tenant.suspended) {
    return jsonError(403, "Таны байгууллага түр хугацаагаар зогссон байна.");
  }

  const accessToken = await signApiToken({
    userId: user.id,
    tenantId: user.tenantId,
    isOwner: user.isOwner,
  });

  const userAgent = req.headers.get("user-agent");
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;

  const { token: refreshToken, expiresAt: refreshExpiresAt } =
    await issueRefreshToken({
      userId: user.id,
      userAgent,
      ip,
    });

  return jsonOk({
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
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
      },
    },
  });
}
