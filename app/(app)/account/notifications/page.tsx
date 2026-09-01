import Link from "next/link";
import { BtnLink, Chip } from "@/app/_components/landing-ops-ui";
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
    hour12: false,
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
    <div className="w-full flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Мэдэгдэл</h1>
          <p className="text-[var(--oc-muted3)] text-sm mt-0.5">
            Танд ирсэн мэдэгдлүүдийн түүх
          </p>
        </div>
        <BtnLink href="/account" variant="ghost">
          ← Буцах
        </BtnLink>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-10 text-center text-sm text-[var(--oc-muted3)]">
          Одоогоор мэдэгдэл алга байна.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((n) => (
            <Link
              key={n.id}
              href={notificationHref(n.type, n.data)}
              className={`rounded-[10px] bg-[var(--oc-panel)] p-4 border transition-colors hover:bg-[var(--oc-panel2)] ${
                n.readAt
                  ? "border-[var(--oc-line)]"
                  : "border-[var(--oc-accent)]/30 bg-[var(--oc-accent)]/[0.05]"
              }`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[var(--oc-ink)]">
                      {n.title}
                    </span>
                    <Chip tone="accent" bordered>
                      {NOTIFICATION_TYPE_LABEL[
                        n.type as keyof typeof NOTIFICATION_TYPE_LABEL
                      ] ?? n.type}
                    </Chip>
                    {n.readAt ? null : (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--oc-accent)]" />
                    )}
                  </div>
                  <div className="text-sm text-[var(--oc-muted)] mt-1">{n.body}</div>
                </div>
                <div className="text-xs text-[var(--oc-muted3)] whitespace-nowrap tabular-nums">
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
