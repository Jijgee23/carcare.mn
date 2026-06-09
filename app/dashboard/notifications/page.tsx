import Link from "next/link";
import { Prisma } from "@/app/generated/prisma/client";
import { FilterSelect, ResetFilters } from "@/app/_components/list-filters";
import { EmptyState, PageHeader } from "@/app/_components/page-header";
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
      <PageHeader
        title="Мэдэгдэл"
        description="Танд ирсэн мэдэгдлүүдийн түүх."
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "1rem",
        }}
      >
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
        <div className="glass rounded-xl overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="px-5 py-3 border-b border-white/[0.06] text-xs text-white/40">
            Нийт {total.toLocaleString("mn-MN")} мэдэгдэл · {page}/{totalPages}{" "}
            хуудас
          </div>

          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Огноо", "Төрөл", "Мэдэгдэл", "Төлөв"].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs text-white/30 font-medium px-5 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((n) => {
                  const href = notificationHref(n.type, n.data);
                  return (
                    <tr
                      key={n.id}
                      className={`border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors ${
                        n.readAt ? "" : "bg-violet-500/[0.04]"
                      }`}
                    >
                      <td className="px-5 py-3 text-xs text-white/60 whitespace-nowrap">
                        {fmtDate(n.createdAt)}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30 whitespace-nowrap">
                          {NOTIFICATION_TYPE_LABEL[
                            n.type as keyof typeof NOTIFICATION_TYPE_LABEL
                          ] ?? n.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <Link
                          href={href}
                          className="text-white/85 hover:text-violet-200 font-medium transition-colors"
                        >
                          {n.title}
                        </Link>
                        <div className="text-xs text-white/40">{n.body}</div>
                      </td>
                      <td className="px-5 py-3">
                        {n.readAt ? (
                          <span className="text-xs text-white/30">Уншсан</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-200">
                            Шинэ
                          </span>
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
