import Link from "next/link";
import { requireAccount } from "@/lib/auth/account";
import {
  NOTIFICATION_TYPE_LABEL,
  notificationHref,
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Мэдэгдэл" };

export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return d.toLocaleString("mn-MN", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AccountNotificationsPage() {
  const account = await requireAccount();

  const rows = await prisma.notification.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Мэдэгдэл</h1>
          <p className="text-white/40 text-sm mt-0.5">
            Танд ирсэн мэдэгдлүүдийн түүх
          </p>
        </div>
        <Link
          href="/account"
          className="text-sm text-white/50 hover:text-white border border-white/[0.1] hover:bg-white/[0.05] px-4 py-2 rounded-lg transition-colors"
        >
          ← Буцах
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="glass rounded-2xl p-10 border border-white/[0.08] text-center text-sm text-white/40">
          Одоогоор мэдэгдэл алга байна.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((n) => (
            <Link
              key={n.id}
              href={notificationHref(n.type, n.data)}
              className={`glass rounded-2xl p-4 border transition-colors hover:bg-white/[0.03] ${
                n.readAt
                  ? "border-white/[0.08]"
                  : "border-violet-500/30 bg-violet-500/[0.05]"
              }`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white/90">
                      {n.title}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
                      {NOTIFICATION_TYPE_LABEL[
                        n.type as keyof typeof NOTIFICATION_TYPE_LABEL
                      ] ?? n.type}
                    </span>
                    {n.readAt ? null : (
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                    )}
                  </div>
                  <div className="text-sm text-white/55 mt-1">{n.body}</div>
                </div>
                <div className="text-xs text-white/35 whitespace-nowrap tabular-nums">
                  {formatDate(n.createdAt)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
