import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { setBypassContext, setTenantContext } from "@/lib/tenant-context";

const ALG = "HS256";
// Access token нь богино настай — мобайл клиент refresh-ээр шинэчилнэ.
export const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24; // 24 цаг

export type ApiTokenPayload = {
  userId: string;
  tenantId: string;
  isOwner: boolean;
};

function getSecret(): Uint8Array {
  // Анхдагч нь session-тэй ижил secret-г ашиглана
  const secret = process.env.API_TOKEN_SECRET ?? process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "API_TOKEN_SECRET эсвэл SESSION_SECRET тогтоосон байх ёстой (32+ тэмдэгт).",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signApiToken(payload: ApiTokenPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyApiToken(
  token: string,
): Promise<ApiTokenPayload | null> {
  try {
    const { payload } = await jwtVerify<ApiTokenPayload>(token, getSecret(), {
      algorithms: [ALG],
    });
    if (!payload.userId || !payload.tenantId) return null;
    return {
      userId: payload.userId,
      tenantId: payload.tenantId,
      isOwner: Boolean(payload.isOwner),
    };
  } catch {
    return null;
  }
}

export type ApiUser = NonNullable<
  Awaited<ReturnType<typeof getApiUserFromRequest>>
>;

/**
 * Authorization: Bearer <token> header-аас хэрэглэгчийг тогтооно.
 * Олдохгүй эсвэл token хүчингүй бол null.
 */
export async function getApiUserFromRequest(req: Request) {
  // JWT verify (jose/WebCrypto)-ээс өмнө context тавина (lib/auth/index.ts
  // дахь getSession-тэй адил шалтгаанаар) — tenantId хараахан тодорхойгүй тул
  // түр bypass, доор мэдэгдмэгц tenant context руу шинэчилнэ.
  setBypassContext();
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const payload = await verifyApiToken(match[1]);
  if (!payload) return null;
  // JWT-д token үүсгэх үед бичигдсэн, гарын үсэгээр баталгаажсан tenantId
  // тул энэ цэгээс шууд итгэж болно.
  setTenantContext(payload.tenantId);
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      isOwner: true,
      tenantId: true,
      branchId: true,
      role: {
        select: { id: true, name: true, permissions: true, isActive: true },
      },
    },
  });
  if (!user) return null;
  return user;
}
