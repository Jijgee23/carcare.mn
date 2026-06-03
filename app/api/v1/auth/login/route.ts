import { enforceRateLimit, jsonError, jsonOk } from "@/lib/api";
import { checkUserActive } from "@/lib/auth/active";
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

const MAX_LOGIN_ATTEMPTS = 5;

export async function POST(req: Request) {
  // IP-ийн түвшний throttle (brute-force-ийн нэмэлт давхарга).
  const limited = enforceRateLimit(req, "api-login", {
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

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

  // Аккаунт түгжигдсэн эсэх (web login-тэй ижил DB-backed lockout).
  if (user.lockedAt) {
    return jsonError(
      423,
      "Хэт олон удаа буруу оролдсон тул аккаунт түгжигдсэн. Нууц үгээ сэргээнэ үү.",
    );
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const nextAttempts = user.failedLoginAttempts + 1;
    const willLock = nextAttempts >= MAX_LOGIN_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: nextAttempts,
        lockedAt: willLock ? new Date() : undefined,
      },
    });
    if (willLock) {
      return jsonError(
        423,
        "Хэт олон удаа буруу оролдсон тул аккаунт түгжигдсэн. Нууц үгээ сэргээнэ үү.",
      );
    }
    return jsonError(401, "Имэйл эсвэл нууц үг буруу.");
  }

  if (user.tenant.suspended) {
    return jsonError(403, "Таны байгууллага түр хугацаагаар зогссон байна.");
  }

  // Идэвхгүй / хугацаа дууссан ажилтан нэвтрэхгүй (web login-тэй ижил).
  const active = checkUserActive({
    isActive: user.isActive,
    activeUntil: user.activeUntil,
  });
  if (!active.ok) {
    return jsonError(403, active.message);
  }

  // Амжилттай — алдааны тоологчийг тэглэнэ.
  if (user.failedLoginAttempts > 0 || user.lockedAt) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedAt: null },
    });
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
