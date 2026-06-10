import { enforceRateLimit, jsonError, jsonOk } from "@/lib/api";
import { checkUserActive } from "@/lib/auth/active";
import { buildApiLoginResponse } from "@/lib/auth/api-login";
import { revokeAllOtps, verifyOtp } from "@/lib/auth/otp";
import { hashPassword } from "@/lib/auth/password";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/v1/auth/activate  { email, code, password } → access/refresh token
 *
 * Веб дэх activateAccountAction-ийн мобайл хувилбар. Идэвхжээгүй ажилтан
 * (passwordHash=null, verified=false) утсандаа ирсэн OTP-ээ оруулж шинэ нууц
 * үгээ тогтоосноор аккаунт идэвхжиж (verified=true), шууд нэвтэрнэ — нэвтрэлтийн
 * хариу нь /auth/login-тэй ижил (access + refresh token + user).
 */
export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "api-activate", {
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
  const { email, code, password } = (body ?? {}) as {
    email?: unknown;
    code?: unknown;
    password?: unknown;
  };

  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : "";
  const otpCode = typeof code === "string" ? code.trim() : "";
  const pwd = typeof password === "string" ? password : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return jsonError(400, "Имэйл хаяг буруу.");
  }
  if (!/^\d{6}$/.test(otpCode)) {
    return jsonError(400, "6 оронтой код шаардлагатай.");
  }
  if (pwd.length < 8) {
    return jsonError(400, "Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой.");
  }

  const otp = await verifyOtp({
    email: normalizedEmail,
    type: "SET_PASSWORD",
    code: otpCode,
  });
  if (!otp.ok) {
    const msg =
      otp.reason === "expired"
        ? "Кодны хугацаа дууссан. Шинээр код илгээнэ үү."
        : otp.reason === "too_many_attempts"
          ? "Хэт олон удаа буруу оролдсон. Шинээр код илгээнэ үү."
          : "Код буруу байна.";
    return jsonError(401, msg);
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      tenant: { select: { id: true, name: true, suspended: true } },
      role: { select: { id: true, name: true, permissions: true } },
    },
  });
  if (!user) {
    return jsonError(404, "Хэрэглэгч олдсонгүй.");
  }
  if (user.verified) {
    return jsonError(
      409,
      "Аккаунт аль хэдийн идэвхжсэн байна. Нууц үгээрээ нэвтэрнэ үү.",
    );
  }
  if (user.tenant.suspended) {
    return jsonError(403, "Таны байгууллага түр хугацаагаар зогссон байна.");
  }
  const active = checkUserActive({
    isActive: user.isActive,
    activeUntil: user.activeUntil,
  });
  if (!active.ok) {
    return jsonError(403, active.message);
  }

  const passwordHash = await hashPassword(pwd);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      verified: true,
      failedLoginAttempts: 0,
      lockedAt: null,
    },
  });
  await revokeAllOtps(normalizedEmail, "SET_PASSWORD");

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entity: "User",
    entityId: user.id,
    action: "LOGIN",
    summary: `${user.email} · аккаунт идэвхжүүлэв (mobile)`,
  });

  return jsonOk(await buildApiLoginResponse(user, req));
}
