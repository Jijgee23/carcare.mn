import { SignJWT, jwtVerify } from "jose";

// Эцсийн хэрэглэгчийн (Account) session — тенантын User болон SuperAdmin-аас
// тусдаа cookie + tag-тай. Утсаар OTP-ээр нэвтэрсэн global бүртгэл.
export const ACCOUNT_COOKIE_NAME = "carcare_account_session";
const ALG = "HS256";
export const ACCOUNT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 60; // 60 хоног

export type AccountSessionPayload = {
  accountId: string;
  phone: string;
};

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET орчны хувьсагч заавал шаардлагатай (32+ тэмдэгт).",
    );
  }
  // Account session-д tag нэмэх — User / system session-той эргэлзэхгүйн тулд
  return new TextEncoder().encode(`account:${secret}`);
}

export async function signAccountSession(
  payload: AccountSessionPayload,
): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${ACCOUNT_SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyAccountSession(
  token: string,
): Promise<AccountSessionPayload | null> {
  try {
    const { payload } = await jwtVerify<AccountSessionPayload>(
      token,
      getSecret(),
      { algorithms: [ALG] },
    );
    if (!payload.accountId || !payload.phone) return null;
    return {
      accountId: payload.accountId,
      phone: payload.phone,
    };
  } catch {
    return null;
  }
}
