import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { checkUserActive } from "./active";
import { clearSessionCookie, getSessionCookie } from "./cookies";
import { verifySession, type SessionPayload } from "./session";
import { validateUserSession } from "./user-session";

export type { SessionPayload } from "./session";

/**
 * Cookie-оос session-ийг уншиж, баталгаажуулна. Хүчингүй бол null.
 * Request бүрд нэг л удаа дуудна (React cache).
 */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const token = await getSessionCookie();
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload) return null;
  // sid-тэй (шинэ) token бол DB session-ийг шалгана — revoke/expire-д шууд гарна.
  // sid-гүй хуучин token-ийг JWT хүчинтэй хэвээр (backward-compat) үлдээнэ.
  if (payload.sid && !(await validateUserSession(payload.sid))) return null;
  return payload;
});

/**
 * Server Component / Server Action дотроос дуудна. Session байхгүй бол /page/login руу redirect.
 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/page/login");
  return session;
}

/**
 * Одоогийн нэвтэрсэн хэрэглэгчийг tenant-тай нь хамт буцаана.
 * Request бүрд нэг л удаа DB-д хандана.
 */
export const requireUser = cache(async () => {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      tenant: true,
      role: { select: { id: true, name: true, permissions: true, isActive: true } },
    },
  });
  if (!user) redirect("/page/login");

  // Идэвхгүй / хугацаа дууссан хэрэглэгчийг session-оос гаргана
  const active = checkUserActive({
    isActive: user.isActive,
    activeUntil: user.activeUntil,
  });
  if (!active.ok) {
    await clearSessionCookie();
    redirect("/page/login");
  }
  return user;
});
