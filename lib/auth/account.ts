import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";
import {
  clearAccountSessionCookie,
  getAccountSessionCookie,
} from "./account-cookies";
import {
  verifyAccountSession,
  type AccountSessionPayload,
} from "./account-session";

export type { AccountSessionPayload } from "./account-session";

// Эцсийн хэрэглэгч нэвтрэх хэсэг (онлайн цаг захиалга). Тенантын login руу биш.
const ACCOUNT_LOGIN_PATH = "/login";

/**
 * Cookie-оос Account session-ийг уншиж, баталгаажуулна. Хүчингүй бол null.
 * Request бүрд нэг л удаа дуудна (React cache).
 */
export const getAccountSession = cache(
  async (): Promise<AccountSessionPayload | null> => {
    // JWT verify (jose/WebCrypto)-ээс өмнө context тавина (lib/auth/index.ts
    // дахь getSession-тэй адил шалтгаанаар).
    setBypassContext();
    const token = await getAccountSessionCookie();
    if (!token) return null;
    return verifyAccountSession(token);
  },
);

export async function requireAccountSession(): Promise<AccountSessionPayload> {
  const session = await getAccountSession();
  if (!session) redirect(ACCOUNT_LOGIN_PATH);
  return session;
}

/**
 * Нэвтэрсэн Account-ийг буцаана. Session байхгүй / идэвхгүй бол login руу.
 * Request бүрд нэг л удаа DB-д хандана.
 */
export const requireAccount = cache(async () => {
  const session = await requireAccountSession();
  // Account глобал (tenant-гүй) объект — доорх урсгал ихэвчлэн cross-tenant
  // (олон tenant-д Customer-тэй байж болно) эсвэл tenant-ийг өөр контекстоос
  // (branchId, slug г.м.) тодорхойлдог тул энд bypass тавина. Бодит бичих
  // үйлдлүүд өөрсдийн tenantId-г тухайн үедээ ил тод оноодог.
  setBypassContext();
  const account = await prisma.account.findUnique({
    where: { id: session.accountId },
  });
  if (!account || !account.isActive) {
    await clearAccountSessionCookie();
    redirect(ACCOUNT_LOGIN_PATH);
  }
  return account;
});

/**
 * Заавал биш хувилбар — Account байвал буцаана, үгүй бол null (redirect хийхгүй).
 * Public хуудсанд "нэвтэрсэн эсэх"-ийг зөөлөн шалгахад.
 */
export const getAccount = cache(async () => {
  const session = await getAccountSession();
  if (!session) return null;
  setBypassContext();
  const account = await prisma.account.findUnique({
    where: { id: session.accountId },
  });
  if (!account || !account.isActive) return null;
  return account;
});
