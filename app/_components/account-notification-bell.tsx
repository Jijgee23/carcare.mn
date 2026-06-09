"use client";

import {
  getAccountUnreadCount,
  getRecentAccountNotifications,
  markAccountNotificationRead,
  markAllAccountNotificationsRead,
} from "@/app/_actions/account-notifications";
import { NotificationBell } from "./notification-bell";

// Үйлчлүүлэгчийн (Account) хонх — account server action-уудыг шууд холбоно.
export function AccountNotificationBell({
  initialUnread,
}: {
  initialUnread: number;
}) {
  return (
    <NotificationBell
      initialUnread={initialUnread}
      getUnreadCount={getAccountUnreadCount}
      getRecent={getRecentAccountNotifications}
      markRead={markAccountNotificationRead}
      markAllRead={markAllAccountNotificationsRead}
      historyHref="/account/notifications"
    />
  );
}
