import Link from "next/link";
import { Prisma } from "@/app/generated/prisma/client";
import { Chip, type ChipTone } from "@/app/_components/landing-ops-ui";
import { FilterSelect, ResetFilters, SearchBox } from "@/app/_components/list-filters";
import { EmptyState } from "@/app/_components/page-header";
import { Pagination } from "@/app/_components/pagination";
import { requireUser } from "@/lib/auth";
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

const STATUS_TONE: Record<string, ChipTone> = {
  NEW: "accent",
  IN_REVIEW: "warn",
  RESOLVED: "ok",
  DISMISSED: "neutral",
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

export default async function DashboardFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = sp.q ?? "";
  const status = sp.status ?? "";
  const type = sp.type ?? "";
  const { page, pageSize, skip, take } = getPageInfo(sp.page);

  const where: Prisma.FeedbackWhereInput = { tenantId: user.tenantId };
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
        user: { select: { firstName: true, lastName: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.feedback.count({ where }),
  ]);
  const meta = buildMeta(total, page, pageSize);

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--oc-ink)]">Санал хүсэлт</h1>
        <p className="text-sm text-[var(--oc-muted3)] mt-1">
          Байгууллагаас илгээсэн санал хүсэлт, алдааны мэдээлэл ба админы хариу.
        </p>
      </div>

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
          description="Одоогоор та санал хүсэлт илгээгээгүй байна. Sidebar доторх Санал хүсэлт товчоор шинээр илгээж болно."
        />
      ) : (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-x-auto">
          <table className="w-full min-w-[780px]">
            <thead>
              <tr className="border-b border-[var(--oc-line)]">
                {["Огноо", "Төрөл", "Илгээсэн", "Мессеж", "Төлөв"].map((h) => (
                  <th key={h} className="text-left font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)] font-medium px-5 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--oc-line)]">
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-5 py-3 font-plex-mono text-xs text-[var(--oc-muted3)] tabular-nums whitespace-nowrap">
                    {fmt(r.createdAt)}
                  </td>
                  <td className="px-5 py-3 text-sm text-[var(--oc-ink2)]">
                    {FEEDBACK_TYPE_LABEL[r.type]}
                  </td>
                  <td className="px-5 py-3 text-sm text-[var(--oc-ink2)]">
                    {r.user ? `${r.user.lastName} ${r.user.firstName}` : "—"}
                  </td>
                  <td className="px-5 py-3 text-sm text-[var(--oc-muted2)] max-w-[24rem] truncate">
                    <Link
                      href={`/dashboard/feedback/${r.id}`}
                      className="inline-flex items-center gap-1.5 hover:text-[var(--oc-ink)] hover:underline"
                    >
                      <span className="truncate">{r.message}</span>
                      {r._count.messages > 0 ? (
                        <span className="shrink-0 rounded-full bg-[var(--oc-panel2)] border border-[var(--oc-line)] px-1.5 py-0.5 font-plex-mono text-[10px] text-[var(--oc-muted2)]">
                          {r._count.messages}
                        </span>
                      ) : null}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <Chip tone={STATUS_TONE[r.status] ?? "neutral"}>
                      {FEEDBACK_STATUS_LABEL[r.status]}
                    </Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={meta.page}
        totalPages={meta.totalPages}
        total={meta.total}
        params={{ q, status, type }}
      />
    </div>
  );
}
