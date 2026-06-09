import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "carcare_session";
const ALG = "HS256";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 хоног

export type SessionPayload = {
  userId: string;
  tenantId: string;
  isOwner: boolean;
  sid?: string; // UserSession id — төхөөрөмж/revoke хөтлөлтөд (хуучин token-д байхгүй)
};

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET орчны хувьсагч заавал шаардлагатай (32+ тэмдэгт).",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySession(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, getSecret(), {
      algorithms: [ALG],
    });
    if (!payload.userId || !payload.tenantId) return null;
    return {
      userId: payload.userId,
      tenantId: payload.tenantId,
      isOwner: Boolean(payload.isOwner),
      sid: typeof payload.sid === "string" ? payload.sid : undefined,
    };
  } catch {
    return null;
  }
}
