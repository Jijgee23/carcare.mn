import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";
import { createJwtSession } from "@/lib/auth/jwt-session";

// Эцсийн хэрэглэгчийн (Account) мобайл API token. User-ийн api-token-аас tag-аар
// тусгаарлагдсан. Refresh-гүй, хугацаагүй (`exp` claim-гүй) — зөвхөн Account.isActive
// = false болгосноор хүчингүй болно (getApiAccountFromRequest-д шалгадаг).

export type AccountTokenPayload = {
  accountId: string;
  phone: string;
};

const client = createJwtSession<AccountTokenPayload>({
  tag: "account-api",
  secretEnvVars: ["API_TOKEN_SECRET", "SESSION_SECRET"],
  parse(payload) {
    if (!payload.accountId || !payload.phone) return null;
    return {
      accountId: payload.accountId as string,
      phone: payload.phone as string,
    };
  },
});

export const signAccountApiToken = client.sign;
export const verifyAccountApiToken = client.verify;

/** Authorization: Bearer <token>-аас Account-ийг тогтооно. Хүчингүй бол null. */

export async function getApiAccountFromRequest(req: Request) {
  // JWT verify (jose/WebCrypto)-ээс өмнө context тавина — Account глобал
  // (tenant-гүй) объект тул bypass (lib/auth/account.ts-ийн getAccount-той адил).
  setBypassContext();
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
