"use client";

import {
  getRecentStaffNotifications,
  getStaffUnreadCount,
  markAllStaffNotificationsRead,
  markStaffNotificationRead,
} from "@/app/_actions/notifications";
import { NotificationBell } from "./notification-bell";

// Ажилтны (User) хонх — staff server action-уудыг шууд холбоно.
export function StaffNotificationBell({
  initialUnread,
  align,
}: {
  initialUnread: number;
  align?: "left" | "right";
}) {
  return (
    <NotificationBell
      initialUnread={initialUnread}
      getUnreadCount={getStaffUnreadCount}
      getRecent={getRecentStaffNotifications}
      markRead={markStaffNotificationRead}
      markAllRead={markAllStaffNotificationsRead}
      historyHref="/dashboard/notifications"
      align={align}
    />
  );
}
