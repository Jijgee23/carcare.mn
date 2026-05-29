import {
  AdminSidebar,
  MobileTopbar,
} from "@/app/_components/admin-sidebar";
import { ToastProvider } from "@/app/_components/toast";
import { TrialBanner } from "@/app/_components/trial-banner";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveActiveSubscription } from "@/lib/subscription";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const initials =
    (user.firstName[0] ?? "") + (user.lastName[0] ?? "");
  const userName = `${user.firstName} ${user.lastName}`.trim();

  const subscriptions = await prisma.subscription.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { startsAt: "desc" },
    select: {
      id: true,
      plan: true,
      status: true,
      startsAt: true,
      endsAt: true,
    },
  });
  const activeSub = resolveActiveSubscription(subscriptions);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#0a0a0f] flex">
        <AdminSidebar
          userName={userName}
          userEmail={user.email}
          initials={initials.toUpperCase()}
          tenantName={user.tenant.name}
          tenantLogoUrl={user.tenant.logoUrl}
        />
        <div className="flex-1 lg:ml-60 min-h-screen flex flex-col">
          <MobileTopbar
            tenantName={user.tenant.name}
            tenantLogoUrl={user.tenant.logoUrl}
            initials={initials.toUpperCase()}
          />
          <TrialBanner active={activeSub} plan={user.tenant.plan} />
          <main className="flex-1 flex flex-col">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
