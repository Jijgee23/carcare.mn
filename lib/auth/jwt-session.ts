/**
 * JWT-д суурилсан session/token-уудын нийтлэг цөм — sign/verify, secret
 * шийдвэрлэлт (env var + tag), нэвтрэлт хугацаа. `lib/auth/session.ts`
 * (User), `account-session.ts` (Account), `system-session.ts` (SuperAdmin),
 * `api-token.ts`/`account-api-token.ts` (мобайл) — эдгээр 5 файл өмнө нь
 * `SignJWT`/`jwtVerify` + secret-баталгаажуулалтыг тус тусдаа хуулбарлаж
 * бичсэн байсныг нэгтгэсэн (харах: `lib/qpay-core.ts`-ийн адил зарчим).
 */

import { SignJWT, jwtVerify } from "jose";

const ALG = "HS256";

export type JwtSessionConfig<Payload> = {
  /** Секретэд угсрах tag (жиш нь "account", "system") — өөр session
   * төрөлтэй андуурахгүйн тулд. Өгөгдөөгүй бол секретийг шууд ашиглана. */
  tag?: string;
  /** Секретийг агуулах орчны хувьсагчийн нэрс — эрэмбээр эхнийхийг олдвол
   * ашиглана (жиш нь ["API_TOKEN_SECRET", "SESSION_SECRET"]). */
  secretEnvVars: string[];
  /** Секундээр хугацаа — өгөгдөөгүй бол `exp` claim тавихгүй (мөнх token). */
  maxAgeSeconds?: number;
  /** JWT payload-оос шаардлагатай талбаруудыг задлана, дутуу/буруу бол null. */
  parse(payload: Record<string, unknown>): Payload | null;
};

function resolveSecret(envVars: string[], tag?: string): Uint8Array {
  let secret: string | undefined;
  for (const name of envVars) {
    secret = process.env[name];
    if (secret) break;
  }
  if (!secret || secret.length < 32) {
    throw new Error(
      `${envVars.join(" эсвэл ")} орчны хувьсагч заавал шаардлагатай (32+ тэмдэгт).`,
    );
  }
  return new TextEncoder().encode(tag ? `${tag}:${secret}` : secret);
}

export function createJwtSession<Payload extends Record<string, unknown>>(
  config: JwtSessionConfig<Payload>,
) {
  async function sign(payload: Payload): Promise<string> {
    let builder = new SignJWT({ ...payload })
      .setProtectedHeader({ alg: ALG })
      .setIssuedAt();
    if (config.maxAgeSeconds !== undefined) {
      builder = builder.setExpirationTime(`${config.maxAgeSeconds}s`);
    }
    return builder.sign(resolveSecret(config.secretEnvVars, config.tag));
  }

  async function verify(token: string): Promise<Payload | null> {
    try {
      const { payload } = await jwtVerify(
        token,
        resolveSecret(config.secretEnvVars, config.tag),
        { algorithms: [ALG] },
      );
      return config.parse(payload as Record<string, unknown>);
    } catch {
      return null;
    }
  }

  return { sign, verify };
}
