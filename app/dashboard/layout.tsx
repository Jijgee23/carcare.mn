import {
  AdminSidebar,
  MobileTopbar,
} from "@/app/_components/admin-sidebar";
import { SubscriptionBanner } from "@/app/_components/subscription-banner";
import { SubscriptionGuard } from "@/app/_components/subscription-guard";
import { ToastProvider } from "@/app/_components/toast";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSubscriptionState } from "@/lib/subscription-server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const initials =
    (user.firstName[0] ?? "") + (user.lastName[0] ?? "");
  const userName = `${user.firstName} ${user.lastName}`.trim();

  const [subState, unreadNotifications] = await Promise.all([
    getSubscriptionState(user.tenantId),
    prisma.notification.count({
      where: { userId: user.id, readAt: null },
    }),
  ]);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#0a0a0f] flex">
        <AdminSidebar
          userName={userName}
          userEmail={user.email}
          initials={initials.toUpperCase()}
          tenantName={user.tenant.name}
          tenantLogoUrl={user.tenant.logoUrl}
          isOwner={user.isOwner}
          permissions={user.role?.permissions ?? []}
          notificationUnread={unreadNotifications}
        />
        <div className="flex-1 min-w-0 lg:ml-60 min-h-screen flex flex-col relative isolate">
          <div aria-hidden className="content-bg-layer" />
          <MobileTopbar
            userName={userName}
            userEmail={user.email}
            tenantName={user.tenant.name}
            tenantLogoUrl={user.tenant.logoUrl}
            initials={initials.toUpperCase()}
            isOwner={user.isOwner}
            permissions={user.role?.permissions ?? []}
            notificationUnread={unreadNotifications}
          />
          <SubscriptionGuard locked={subState.locked} isOwner={user.isOwner} />
          <SubscriptionBanner
            locked={subState.locked}
            isTrial={subState.active?.isTrial ?? false}
            daysLeft={subState.active?.daysLeft ?? 0}
            expiresAt={subState.active?.expiresAt ?? null}
            expiringSoon={subState.expiringSoon}
            hasPendingPayment={subState.hasPendingPayment}
            isOwner={user.isOwner}
          />
          <main className="flex-1 flex flex-col min-w-0">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
