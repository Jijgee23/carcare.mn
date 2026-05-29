import { SignJWT, jwtVerify } from "jose";

export const SYSTEM_COOKIE_NAME = "carcare_system_session";
const ALG = "HS256";
export const SYSTEM_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 цаг — system admin богино

export type SystemSessionPayload = {
  adminId: string;
  email: string;
};

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET орчны хувьсагч заавал шаардлагатай (32+ тэмдэгт).",
    );
  }
  // System session-д tag нэмэх — tenant session-той эргэлзэхгүйн тулд
  return new TextEncoder().encode(`system:${secret}`);
}

export async function signSystemSession(
  payload: SystemSessionPayload,
): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${SYSTEM_SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySystemSession(
  token: string,
): Promise<SystemSessionPayload | null> {
  try {
    const { payload } = await jwtVerify<SystemSessionPayload>(
      token,
      getSecret(),
      { algorithms: [ALG] },
    );
    if (!payload.adminId || !payload.email) return null;
    return {
      adminId: payload.adminId,
      email: payload.email,
    };
  } catch {
    return null;
  }
}
