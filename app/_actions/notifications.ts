"use server";

import { requireUser } from "@/lib/auth";
import {
  type NotificationItem,
  toNotificationItem,
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

// Ажилтны (User) мэдэгдэлийн server action-ууд. Бүгд өөрийн (нэвтэрсэн) мөрөнд л
// хандана — тенант хоорондын тусгаарлал requireUser-ээр хангагдана.

export async function getStaffUnreadCount(): Promise<number> {
  const user = await requireUser();
  return prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });
}

export async function getRecentStaffNotifications(): Promise<NotificationItem[]> {
  const user = await requireUser();
  const rows = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return rows.map(toNotificationItem);
}

/** Нэг мэдэгдлийг уншсан болгож, шинэ уншаагүй тоог буцаана. */
export async function markStaffNotificationRead(id: string): Promise<number> {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { id, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });
}

export async function markAllStaffNotificationsRead(): Promise<number> {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return 0;
}
