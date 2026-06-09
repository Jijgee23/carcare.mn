import { jsonError, jsonOk } from "@/lib/api";
import {
  ACCOUNT_ACCESS_TOKEN_MAX_AGE_SECONDS,
  signAccountApiToken,
} from "@/lib/auth/account-api-token";
import { verifyPhoneOtp } from "@/lib/auth/otp";
import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

// POST /api/v1/app/auth/verify-otp  { phone, code, name? } → accessToken
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON body шаардлагатай.");
  }
  const b = body as { phone?: unknown; code?: unknown; name?: unknown };
  const phone = normalizePhone(typeof b.phone === "string" ? b.phone : "");
  const code = typeof b.code === "string" ? b.code.trim() : "";
  const name = typeof b.name === "string" ? b.name.trim() : "";

  if (!phone) return jsonError(400, "Утасны дугаар буруу.");
  if (!/^\d{6}$/.test(code)) return jsonError(400, "6 оронтой код шаардлагатай.");

  const result = await verifyPhoneOtp({ phone, type: "CONSUMER_LOGIN", code });
  if (!result.ok) {
    const msg =
      result.reason === "expired"
        ? "Кодны хугацаа дууссан."
        : result.reason === "too_many_attempts"
          ? "Хэт олон удаа буруу оролдсон."
          : "Код буруу байна.";
    return jsonError(401, msg);
  }

  let account = await prisma.account.findUnique({ where: { phone } });
  if (account && !account.isActive) {
    return jsonError(403, "Энэ дугаар түр хаагдсан байна.");
  }
  if (!account) {
    account = await prisma.account.create({
      data: { phone, name: name || null, lastLoginAt: new Date() },
    });
  } else {
    account = await prisma.account.update({
      where: { id: account.id },
      data: {
        lastLoginAt: new Date(),
        ...(name && !account.name ? { name } : {}),
      },
    });
  }

  const accessToken = await signAccountApiToken({
    accountId: account.id,
    phone: account.phone,
  });

  return jsonOk({
    accessToken,
    expiresInSeconds: ACCOUNT_ACCESS_TOKEN_MAX_AGE_SECONDS,
    account: { id: account.id, phone: account.phone, name: account.name },
  });
}
