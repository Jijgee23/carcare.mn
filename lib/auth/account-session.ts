import { createJwtSession } from "@/lib/auth/jwt-session";

// Эцсийн хэрэглэгчийн (Account) session — тенантын User болон SuperAdmin-аас
// тусдаа cookie + tag-тай. Утсаар OTP-ээр нэвтэрсэн global бүртгэл.
export const ACCOUNT_COOKIE_NAME = "carcare_account_session";
export const ACCOUNT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 60; // 60 хоног

export type AccountSessionPayload = {
  accountId: string;
  phone: string;
};

const client = createJwtSession<AccountSessionPayload>({
  tag: "account",
  secretEnvVars: ["SESSION_SECRET"],
  maxAgeSeconds: ACCOUNT_SESSION_MAX_AGE_SECONDS,
  parse(payload) {
    if (!payload.accountId || !payload.phone) return null;
    return {
      accountId: payload.accountId as string,
      phone: payload.phone as string,
    };
  },
});

export const signAccountSession = client.sign;
export const verifyAccountSession = client.verify;
