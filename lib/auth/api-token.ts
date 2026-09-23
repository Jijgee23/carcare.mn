import { prisma } from "@/lib/prisma";
import { setBypassContext, setTenantContext } from "@/lib/tenant-context";
import { createJwtSession } from "@/lib/auth/jwt-session";

// Access token нь богино настай — мобайл клиент refresh-ээр шинэчилнэ.
export const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24; // 24 цаг

export type ApiTokenPayload = {
  userId: string;
  tenantId: string;
  isOwner: boolean;
  // D-180: the RefreshToken.id this access token was issued/rotated
  // alongside — never the raw token or its hash. Optional/nullable so
  // tokens signed before this claim existed keep verifying (backward
  // compatible); `getApiUserFromRequest` exposes it as
  // `refreshTokenId: string | null`.
  refreshTokenId?: string | null;
};

const client = createJwtSession<ApiTokenPayload>({
  // Анхдагч нь session-тэй ижил secret-г ашиглана
  secretEnvVars: ["API_TOKEN_SECRET", "SESSION_SECRET"],
  maxAgeSeconds: ACCESS_TOKEN_MAX_AGE_SECONDS,
  parse(payload) {
    if (!payload.userId || !payload.tenantId) return null;
    return {
      userId: payload.userId as string,
      tenantId: payload.tenantId as string,
      isOwner: Boolean(payload.isOwner),
      refreshTokenId:
        typeof payload.refreshTokenId === "string" ? payload.refreshTokenId : null,
    };
  },
});

export const signApiToken = client.sign;
export const verifyApiToken = client.verify;

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
      assignableBranchIds: true,
      role: {
        select: { id: true, name: true, permissions: true, isActive: true },
      },
    },
  });
  if (!user) return null;
  // D-180: nullable for tokens signed before this claim existed.
  return { ...user, refreshTokenId: payload.refreshTokenId ?? null };
}
