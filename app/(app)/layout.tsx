import Link from "next/link";
import type { ReactNode } from "react";
import { AccountNotificationBell } from "@/app/_components/account-notification-bell";
import { Brand } from "@/app/_components/brand";
import { getAccount } from "@/lib/auth/account";
import { formatPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

// Эцсийн хэрэглэгчийн (Account) вэбийн ерөнхий хүрээ — байгууллага хайх, цаг
// захиалах, миний цагууд. Ажилтны /dashboard, маркетингийн /page-ээс тусдаа.
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

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      <header className="sticky top-0 z-30 glass border-b border-white/[0.06]">
        <div className="w-full px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/discover" className="flex items-center gap-2">
            <Brand />
          </Link>
          <nav className="flex items-center gap-1.5 text-sm">
            <Link
              href="/discover"
              className="px-3 py-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              Газрууд
            </Link>
            {account ? (
              <>
                <AccountNotificationBell initialUnread={unreadNotifications} />
                <Link
                  href="/account"
                  className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/80 transition-colors"
                >
                  {account.name?.trim() || formatPhone(account.phone)}
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 font-medium transition-colors"
              >
                Нэвтрэх
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full px-4 sm:px-6 py-6">{children}</main>

      <footer className="border-t border-white/[0.06] py-6 text-center text-xs text-white/30">
        carcare.mn — авто үйлчилгээний цаг захиалга
      </footer>
    </div>
  );
}
