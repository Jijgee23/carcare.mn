import { prisma } from "@/lib/prisma";
import { revokeAllForUser } from "@/lib/auth/refresh-token";
import { getFirebaseTokensForUser } from "@/lib/devices";
import { notifyAccountClosed } from "./notify";
import { userTombstone } from "./tombstone";

export class ClosureError extends Error {
  constructor(
    public code: "LAST_OWNER" | "OPEN_ORDERS",
    public openOrders = 0,
  ) {
    super(code);
  }
}

// Нээлттэй (SCHEDULED/IN_PROGRESS) захиалга хуваарилагдсан бол устгахыг
// хориглоно — lib/employees/core.ts deleteEmployee-ийн OPEN_ORDERS дүрэмтэй ижил.
export async function assertNoOpenOrders(userId: string): Promise<void> {
  const openOrders = await prisma.serviceOrder.count({
    where: { assignedToId: userId, status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
  });
  if (openOrders > 0) throw new ClosureError("OPEN_ORDERS", openOrders);
}

// Тенантад өөр идэвхтэй owner үлдэхгүй бол хаахыг хориглоно
// (lib/employees/core.ts toggleEmployeeActive-ийн LAST_OWNER дүрэмтэй ижил:
// isOwner && isActive гэсэн predicate, зөвхөн энд шинэ deactivatedAt/deletedAt
// талбаруудыг нэмж шалгана — учир нь эдгээр нь энэ таскаар нэмэгдэж байгаа).
export async function assertNotLastOwner(userId: string): Promise<void> {
  const me = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { isOwner: true, tenantId: true },
  });
  if (!me.isOwner) return;
  const others = await prisma.user.count({
    where: {
      tenantId: me.tenantId,
      isOwner: true,
      isActive: true,
      deactivatedAt: null,
      deletedAt: null,
      id: { not: userId },
    },
  });
  if (others === 0) throw new ClosureError("LAST_OWNER");
}

// Түр хаах: session/refresh token-ууд хүчингүй болно (checkUserActive
// DEACTIVATED-аар цаашид блоклоно). Device устгаснаар push зогсоно. Дахин
// нэвтрэхэд (нууц үгээр) deactivatedAt цэвэрлэгдэнэ. isActive хэвээр true —
// энэ нь "админ блоклосон" гэсэн утгыг хадгалж үлдэх ёстой тул хөндөхгүй.
export async function deactivateStaffUser(userId: string): Promise<void> {
  await assertNotLastOwner(userId);
  await revokeAllForUser(userId);
  const tokens = await getFirebaseTokensForUser(userId);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { deactivatedAt: new Date() } }),
    prisma.userSession.deleteMany({ where: { userId } }),
    prisma.device.deleteMany({ where: { userId } }),
  ]);
  await notifyAccountClosed(tokens, "deactivated");
}

// Бүрмөсөн устгах — буцаагдахгүй. Захиалга/цагийн assignedTo зэрэг FK
// tombstone User-т үлдэж "Устгагдсан ажилтан" гэж харагдана.
export async function deleteStaffUser(userId: string): Promise<void> {
  await assertNotLastOwner(userId);
  await assertNoOpenOrders(userId);
  await revokeAllForUser(userId);
  const tokens = await getFirebaseTokensForUser(userId);
  await prisma.$transaction([
    prisma.userSession.deleteMany({ where: { userId } }),
    prisma.device.deleteMany({ where: { userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: userTombstone(userId, new Date()) }),
  ]);
  await notifyAccountClosed(tokens, "deleted");
}

// Админ ажилтныг устгасны дараа (lib/employees/core.ts deleteEmployee нь
// tombstone бичсэн) — өөрөө устгахтай ижил цэвэрлэгээ: token/session/device/
// мэдэгдэл устгаж, нээлттэй апп-ыг silent push-оор гаргана.
export async function purgeStaffAccess(userId: string): Promise<void> {
  await revokeAllForUser(userId);
  const tokens = await getFirebaseTokensForUser(userId);
  await prisma.$transaction([
    prisma.userSession.deleteMany({ where: { userId } }),
    prisma.device.deleteMany({ where: { userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
  ]);
  await notifyAccountClosed(tokens, "deleted");
}
