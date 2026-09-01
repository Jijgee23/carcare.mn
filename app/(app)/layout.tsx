import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import type { ReactNode } from "react";
import {
  ConsumerMobileTopbar,
  ConsumerSidebar,
} from "@/app/_components/consumer-sidebar";
import { ToastProvider } from "@/app/_components/toast";
import { getAccount } from "@/lib/auth/account";
import { formatPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

// Ops Console дизайны фонт — dashboard-тай ижил механизм, зөвхөн энэ
// (жолооч/хэрэглэгчийн) route бүлэгт scoped.
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
      <div
        className={`${plexSans.variable} ${plexMono.variable} landing-ops min-h-screen bg-[var(--oc-carbon)] flex`}
      >
        <ConsumerSidebar
          loggedIn={loggedIn}
          accountName={accountName}
          accountPhone={accountPhone}
          initial={initial}
          notificationUnread={unreadNotifications}
        />
        <div className="app-content-offset flex-1 min-w-0 min-h-screen flex flex-col relative isolate">
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

          <footer className="border-t border-[var(--oc-line2)]">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 text-center text-xs text-[var(--oc-muted3)]">
              carcare.mn — авто үйлчилгээний цаг захиалга
            </div>
          </footer>
        </div>
      </div>
    </ToastProvider>
  );
}
