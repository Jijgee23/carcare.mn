import type { ReactNode } from "react";
import {
  ConsumerMobileTopbar,
  ConsumerSidebar,
} from "@/app/_components/consumer-sidebar";
import { ToastProvider } from "@/app/_components/toast";
import { getAccount } from "@/lib/auth/account";
import { formatPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

// Эцсийн хэрэглэгчийн (Account) вэбийн ерөнхий хүрээ — байгууллага хайх, цаг
// захиалах, миний цагууд. Ажилтны /dashboard-той адил зүүн sidebar-тай.
export default async function ConsumerLayout({
  children,
}: {
  children: ReactNode;
}) {
  const account = await getAccount();
  const unreadNotifications = account
    ? await prisma.notification.count({
      where: { accountId: account.id, readAt: null },
    })
    : 0;

  const loggedIn = Boolean(account);
  const accountName = account?.name?.trim() ?? "";
  const accountPhone = account ? formatPhone(account.phone) : "";
  const initial = accountName ? accountName[0]?.toUpperCase() ?? null : null;

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[var(--shell-bg-primary)] flex">
        <ConsumerSidebar
          loggedIn={loggedIn}
          accountName={accountName}
          accountPhone={accountPhone}
          initial={initial}
          notificationUnread={unreadNotifications}
        />
        <div className="app-content-offset flex-1 min-w-0 min-h-screen flex flex-col relative isolate">
          <div aria-hidden className="shell-content-bg" />
          <ConsumerMobileTopbar
            loggedIn={loggedIn}
            accountName={accountName}
            accountPhone={accountPhone}
            initial={initial}
            notificationUnread={unreadNotifications}
          />

          <main className="flex-1 w-full">
            <div className="mx-auto w-full max-w-full px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </div>
          </main>

          <footer className="border-t border-white/[0.06]">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 text-center text-xs text-white/30">
              carcare.mn — авто үйлчилгээний цаг захиалга
            </div>
          </footer>
        </div>
      </div>
    </ToastProvider>
  );
}
