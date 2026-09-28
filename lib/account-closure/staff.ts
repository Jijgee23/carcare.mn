import { prisma } from "@/lib/prisma";
import { revokeAllForUser } from "@/lib/auth/refresh-token";
import { userTombstone } from "./tombstone";

export class ClosureError extends Error {
  constructor(public code: "LAST_OWNER") {
    super(code);
  }
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
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { deactivatedAt: new Date() } }),
    prisma.userSession.deleteMany({ where: { userId } }),
    prisma.device.deleteMany({ where: { userId } }),
  ]);
}

// Бүрмөсөн устгах — буцаагдахгүй. Захиалга/цагийн assignedTo зэрэг FK
// tombstone User-т үлдэж "Устгагдсан ажилтан" гэж харагдана.
export async function deleteStaffUser(userId: string): Promise<void> {
  await assertNotLastOwner(userId);
  await revokeAllForUser(userId);
  await prisma.$transaction([
    prisma.userSession.deleteMany({ where: { userId } }),
    prisma.device.deleteMany({ where: { userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: userTombstone(userId, new Date()) }),
  ]);
}
