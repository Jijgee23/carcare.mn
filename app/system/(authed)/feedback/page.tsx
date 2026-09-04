import Link from "next/link";
import { Prisma } from "@/app/generated/prisma/client";
import { FilterSelect, ResetFilters, SearchBox } from "@/app/_components/list-filters";
import { EmptyState, PageHeader } from "@/app/_components/page-header";
import { Pagination } from "@/app/_components/pagination";
import { requireSuperAdmin } from "@/lib/auth/system";
import {
  FEEDBACK_STATUS_LABEL,
  FEEDBACK_STATUS_VALUES,
  FEEDBACK_TYPE_LABEL,
  FEEDBACK_TYPE_VALUES,
  isFeedbackStatus,
  isFeedbackType,
} from "@/lib/feedback";
import { buildMeta, getPageInfo } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Санал хүсэлт" };

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  NEW: "bg-red-500/15 text-red-300 border border-red-500/25 light:bg-red-100 light:border-red-300 light:text-red-700",
  IN_REVIEW: "bg-amber-500/15 text-amber-300 border border-amber-500/25 light:bg-amber-100 light:border-amber-300 light:text-amber-700",
  RESOLVED: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 light:bg-emerald-100 light:border-emerald-300 light:text-emerald-700",
  DISMISSED: "bg-zinc-500/15 text-zinc-300 border border-zinc-500/25 light:bg-zinc-100 light:border-zinc-300 light:text-zinc-600",
};

function fmt(d: Date): string {
  return d.toLocaleString("mn-MN", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

type Search = {
  q?: string;
  status?: string;
  type?: string;
  page?: string;
};

export default async function SystemFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const q = sp.q ?? "";
  const status = sp.status ?? "NEW";
  const type = sp.type ?? "";
  const { page, pageSize, skip, take } = getPageInfo(sp.page);

  const where: Prisma.FeedbackWhereInput = {};
  if (isFeedbackStatus(status)) where.status = status;
  if (isFeedbackType(type)) where.type = type;
  if (q) where.message = { contains: q, mode: "insensitive" };

  const [rows, total] = await Promise.all([
    prisma.feedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        type: true,
        message: true,
        status: true,
        screenshotUrl: true,
        createdAt: true,
        user: {
          select: { firstName: true, lastName: true, tenant: { select: { name: true } } },
        },
        account: { select: { name: true, phone: true } },
      },
    }),
    prisma.feedback.count({ where }),
  ]);
  const meta = buildMeta(total, page, pageSize);

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Санал хүсэлт"
        description="Ажилтан, үйлчлүүлэгчийн илгээсэн санал хүсэлт, алдааны мэдээлэл."
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <SearchBox placeholder="Мессежээр хайх..." />
        <FilterSelect
          paramName="status"
          placeholder="Бүх төлөв"
          options={FEEDBACK_STATUS_VALUES.map((v) => ({
            value: v,
            label: FEEDBACK_STATUS_LABEL[v],
          }))}
        />
        <FilterSelect
          paramName="type"
          placeholder="Бүх төрөл"
          options={FEEDBACK_TYPE_VALUES.map((v) => ({
            value: v,
            label: FEEDBACK_TYPE_LABEL[v],
          }))}
        />
        <ResetFilters paramNames={["q", "status", "type"]} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Бичлэг алга"
          description="Одоогоор энэ шүүлтэд тохирох санал хүсэлт байхгүй байна."
        />
      ) : (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="border-b border-[var(--oc-line2)]">
                {["Огноо", "Төрөл", "Илгээгч", "Мессеж", "Төлөв"].map((h) => (
                  <th key={h} className="text-left text-xs text-[var(--oc-muted4)] font-medium px-5 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const submitter = r.user
                  ? `${r.user.lastName} ${r.user.firstName} (${r.user.tenant.name})`
                  : r.account
                    ? r.account.name?.trim() || r.account.phone
                    : "—";
                return (
                  <tr
                    key={r.id}
                    className="border-b border-[var(--oc-line2)] last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-5 py-3 text-xs text-[var(--oc-muted)] tabular-nums whitespace-nowrap">
                      {fmt(r.createdAt)}
                    </td>
                    <td className="px-5 py-3 text-sm text-[var(--oc-muted)]">
                      {FEEDBACK_TYPE_LABEL[r.type]}
                    </td>
                    <td className="px-5 py-3 text-sm text-[var(--oc-muted)]">{submitter}</td>
                    <td className="px-5 py-3 text-sm text-[var(--oc-muted)] max-w-[28rem] truncate">
                      <Link
                        href={`/system/feedback/${r.id}`}
                        className="inline-flex items-center gap-1.5 hover:text-[var(--oc-ink)] hover:underline"
                      >
                        {r.screenshotUrl ? (
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="shrink-0 text-[var(--oc-muted4)]"
                            aria-label="Зурагтай"
                          >
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="9" cy="9" r="2" />
                            <path d="m21 15-3.5-3.5a2 2 0 0 0-2.8 0L5 21" />
                          </svg>
                        ) : null}
                        <span className="truncate">{r.message}</span>
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full ${STATUS_BADGE[r.status]}`}>
                        {FEEDBACK_STATUS_LABEL[r.status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={meta.page}
        totalPages={meta.totalPages}
        total={meta.total}
        params={{ q, status, type }}
        tone="danger"
      />
    </div>
  );
}
