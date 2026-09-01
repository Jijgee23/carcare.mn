import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import {
  AdminSidebar,
  MobileTopbar,
} from "@/app/_components/admin-sidebar";
import { SubscriptionBanner } from "@/app/_components/subscription-banner";
import { SubscriptionGuard } from "@/app/_components/subscription-guard";
import { ToastProvider } from "@/app/_components/toast";
import { WebPushToggle } from "@/app/_components/web-push";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSubscriptionState } from "@/lib/subscription-server";

// Ops Console дизайны фонт — landing/auth хуудсуудтай ижил механизм, зөвхөн
// dashboard route-д scoped (бусад апп — account/system — Geist хэвээр).
const plexSans = IBM_Plex_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

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
      <div
        className={`${plexSans.variable} ${plexMono.variable} landing-ops min-h-screen bg-[var(--oc-carbon)] flex`}
      >
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
        <div className="app-content-offset flex-1 min-w-0 min-h-screen flex flex-col relative isolate">
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
          <div className="px-4 sm:px-6 lg:px-8 pt-3">
            <section className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--oc-ink2)]">Push мэдэгдэл</div>
                <div className="text-xs text-[var(--oc-muted3)]">
                  Захиалга, цаг захиалгын мэдэгдлийг энэ төхөөрөмж дээр авах.
                </div>
              </div>
              <WebPushToggle target="user" />
            </section>
          </div>
          <main className="flex-1 flex flex-col min-w-0">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
