"use server";

import { requireAccount } from "@/lib/auth/account";
import {
  type NotificationItem,
  toNotificationItem,
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

// Үйлчлүүлэгчийн (Account) мэдэгдэлийн server action-ууд. Бүгд нэвтэрсэн Account-ийн
// өөрийн мөрөнд л хандана.

export async function getAccountUnreadCount(): Promise<number> {
  const account = await requireAccount();
  return prisma.notification.count({
    where: { accountId: account.id, readAt: null },
  });
}

export async function getRecentAccountNotifications(): Promise<NotificationItem[]> {
  const account = await requireAccount();
  const rows = await prisma.notification.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return rows.map(toNotificationItem);
}

/** Нэг мэдэгдлийг уншсан болгож, шинэ уншаагүй тоог буцаана. */
export async function markAccountNotificationRead(id: string): Promise<number> {
  const account = await requireAccount();
  await prisma.notification.updateMany({
    where: { id, accountId: account.id, readAt: null },
    data: { readAt: new Date() },
  });
  return prisma.notification.count({
    where: { accountId: account.id, readAt: null },
  });
}

export async function markAllAccountNotificationsRead(): Promise<number> {
  const account = await requireAccount();
  await prisma.notification.updateMany({
    where: { accountId: account.id, readAt: null },
    data: { readAt: new Date() },
  });
  return 0;
}
