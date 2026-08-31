import Link from "next/link";
import { Prisma } from "@/app/generated/prisma/client";
import { Chip } from "@/app/_components/landing-ops-ui";
import { FilterSelect, ResetFilters } from "@/app/_components/list-filters";
import { EmptyState } from "@/app/_components/page-header";
import { Pagination } from "@/app/_components/pagination";
import { requireUser } from "@/lib/auth";
import {
  NOTIFICATION_TYPE_LABEL,
  notificationHref,
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Мэдэгдэл" };

const PAGE_SIZE = 50;

const TYPE_OPTIONS = Object.entries(NOTIFICATION_TYPE_LABEL).map(
  ([value, label]) => ({ value, label }),
);

function fmtDate(d: Date): string {
  return d.toLocaleString("mn-MN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default async function StaffNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; page?: string }>;
}) {
  const me = await requireUser();
  const { type = "", page: pageStr = "1" } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageStr, 10) || 1);

  const where: Prisma.NotificationWhereInput = { userId: me.id };
  if (type) where.type = type;

  const [rows, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.notification.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--oc-ink)]">Мэдэгдэл</h1>
        <p className="text-sm text-[var(--oc-muted3)] mt-1">
          Танд ирсэн мэдэгдлүүдийн түүх.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <FilterSelect
          paramName="type"
          placeholder="Бүх төрөл"
          options={TYPE_OPTIONS}
        />
        <ResetFilters paramNames={["type"]} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Мэдэгдэл алга"
          description="Танд одоогоор мэдэгдэл ирээгүй байна."
        />
      ) : (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="px-5 py-3 border-b border-[var(--oc-line)] font-plex-mono text-xs text-[var(--oc-muted3)]">
            Нийт {total.toLocaleString("mn-MN")} мэдэгдэл · {page}/{totalPages}{" "}
            хуудас
          </div>

          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-[var(--oc-line)]">
                  {["Огноо", "Төрөл", "Мэдэгдэл", "Төлөв"].map((h) => (
                    <th
                      key={h}
                      className="text-left font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)] font-medium px-5 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--oc-line)]">
                {rows.map((n) => {
                  const href = notificationHref(n.type, n.data);
                  return (
                    <tr
                      key={n.id}
                      className={`hover:bg-white/[0.02] transition-colors ${
                        n.readAt ? "" : "bg-[var(--oc-accent)]/[0.04]"
                      }`}
                    >
                      <td className="px-5 py-3 font-plex-mono text-xs text-[var(--oc-muted2)] whitespace-nowrap">
                        {fmtDate(n.createdAt)}
                      </td>
                      <td className="px-5 py-3">
                        <Chip tone="accent" bordered>
                          {NOTIFICATION_TYPE_LABEL[
                            n.type as keyof typeof NOTIFICATION_TYPE_LABEL
                          ] ?? n.type}
                        </Chip>
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <Link
                          href={href}
                          className="text-[var(--oc-ink)] hover:text-[var(--oc-accent-hi)] font-medium transition-colors"
                        >
                          {n.title}
                        </Link>
                        <div className="text-xs text-[var(--oc-muted3)]">{n.body}</div>
                      </td>
                      <td className="px-5 py-3">
                        {n.readAt ? (
                          <span className="text-xs text-[var(--oc-muted4)]">Уншсан</span>
                        ) : (
                          <Chip tone="accent">Шинэ</Chip>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            params={{ type }}
          />
        </div>
      )}
    </div>
  );
}
