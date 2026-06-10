import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

// Эцсийн хэрэглэгчийн (Account) мобайл API token. User-ийн api-token-аас tag-аар
// тусгаарлагдсан. Refresh-гүй — урт настай (30 хоног) access token.
const ALG = "HS256";
export const ACCOUNT_ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 хоног

export type AccountTokenPayload = {
  accountId: string;
  phone: string;
};

function getSecret(): Uint8Array {
  const secret = process.env.API_TOKEN_SECRET ?? process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "API_TOKEN_SECRET эсвэл SESSION_SECRET тогтоосон байх ёстой (32+ тэмдэгт).",
    );
  }
  return new TextEncoder().encode(`account-api:${secret}`);
}

export async function signAccountApiToken(
  payload: AccountTokenPayload,
): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${ACCOUNT_ACCESS_TOKEN_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyAccountApiToken(
  token: string,
): Promise<AccountTokenPayload | null> {
  try {
    const { payload } = await jwtVerify<AccountTokenPayload>(token, getSecret(), {
      algorithms: [ALG],
    });
    if (!payload.accountId || !payload.phone) return null;
    return { accountId: payload.accountId, phone: payload.phone };
  } catch {
    return null;
  }
}

/** Authorization: Bearer <token>-аас Account-ийг тогтооно. Хүчингүй бол null. */

export async function getApiAccountFromRequest(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const payload = await verifyAccountApiToken(match[1]);
  if (!payload) return null;
  const account = await prisma.account.findUnique({
    where: { id: payload.accountId },
  });
  if (!account || !account.isActive) return null;
  return account;
}
