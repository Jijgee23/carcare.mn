import Link from "next/link";
import { Prisma } from "@/app/generated/prisma/client";
import { FilterSelect, ResetFilters, SearchBox } from "@/app/_components/list-filters";
import { PageHeader } from "@/app/_components/page-header";
import { Pagination } from "@/app/_components/pagination";
import {
  type SessionStatus,
  deviceLabel,
  sessionStatus,
} from "@/lib/auth/user-session";
import { buildMeta, getPageInfo } from "@/lib/pagination";
import { formatPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Нэвтрэлт / Төхөөрөмж" };

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<SessionStatus, string> = {
  active: "Идэвхтэй",
  revoked: "Гарсан",
  expired: "Дууссан",
};
const STATUS_BADGE: Record<SessionStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25",
  revoked: "bg-zinc-500/15 text-zinc-300 border border-zinc-500/25",
  expired: "bg-red-500/10 text-red-400 border border-red-500/20",
};

function fmt(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString("mn-MN", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Search = {
  tab?: string;
  q?: string;
  tenantId?: string;
  page?: string;
};

export default async function SystemSessionsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "customer" ? "customer" : "staff";
  const q = sp.q ?? "";
  const tenantId = sp.tenantId ?? "";
  const { page, pageSize, skip, take } = getPageInfo(sp.page);

  const tabHref = (t: "staff" | "customer") => `/system/sessions?tab=${t}`;

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Нэвтрэлт / Төхөөрөмж"
        description="Ажилтан болон хэрэглэгчийн нэвтэрсэн төхөөрөмжийн түүх."
      />

      {/* Таб */}
      <div className="flex rounded-lg border border-white/[0.1] overflow-hidden self-start mb-4">
        <Link
          href={tabHref("staff")}
          className={`px-4 py-1.5 text-sm transition-colors ${
            tab === "staff"
              ? "bg-violet-600/30 text-violet-200"
              : "text-white/60 hover:bg-white/[0.06]"
          }`}
        >
          Ажилтан
        </Link>
        <Link
          href={tabHref("customer")}
          className={`px-4 py-1.5 text-sm transition-colors border-l border-white/[0.1] ${
            tab === "customer"
              ? "bg-violet-600/30 text-violet-200"
              : "text-white/60 hover:bg-white/[0.06]"
          }`}
        >
          Хэрэглэгч
        </Link>
      </div>

      {tab === "staff" ? (
        <StaffTab q={q} tenantId={tenantId} page={page} pageSize={pageSize} skip={skip} take={take} />
      ) : (
        <CustomerTab q={q} page={page} pageSize={pageSize} skip={skip} take={take} />
      )}
    </div>
  );
}

async function StaffTab({
  q,
  tenantId,
  page,
  pageSize,
  skip,
  take,
}: {
  q: string;
  tenantId: string;
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}) {
  const userWhere: Prisma.UserWhereInput = {};
  if (tenantId) userWhere.tenantId = tenantId;
  if (q) {
    userWhere.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }
  const where: Prisma.UserSessionWhereInput = { user: userWhere };

  const [tenants, rows, total] = await Promise.all([
    prisma.tenant.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.userSession.findMany({
      where,
      orderBy: { lastSeenAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        userAgent: true,
        ip: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
        revokedAt: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            tenant: { select: { name: true } },
          },
        },
      },
    }),
    prisma.userSession.count({ where }),
  ]);
  const meta = buildMeta(total, page, pageSize);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <SearchBox placeholder="Нэр, имэйл, утас..." />
        <FilterSelect
          paramName="tenantId"
          placeholder="Бүх байгууллага"
          searchable
          options={tenants.map((t) => ({ value: t.id, label: t.name }))}
        />
        <ResetFilters paramNames={["q", "tenantId"]} />
      </div>

      {rows.length === 0 ? (
        <Empty />
      ) : (
        <div className="glass rounded-2xl overflow-hidden border border-white/[0.08]">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Байгууллага", "Ажилтан", "Утас", "Төхөөрөмж", "IP", "Нэвтэрсэн", "Төлөв"].map(
                  (h) => (
                    <th key={h} className="text-left text-xs text-white/30 font-medium px-5 py-3">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const st = sessionStatus(r);
                return (
                  <tr key={r.id} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-5 py-3 text-sm text-white/70">
                      {r.user.tenant.name}
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-sm text-white/85">
                        {r.user.lastName} {r.user.firstName}
                      </div>
                      <div className="text-xs text-white/35">{r.user.email}</div>
                    </td>
                    <td className="px-5 py-3 text-sm text-white/60 tabular-nums">
                      {r.user.phone ? formatPhone(r.user.phone) : "—"}
                    </td>
                    <td className="px-5 py-3 text-sm text-white/60">
                      {deviceLabel(r.userAgent)}
                    </td>
                    <td className="px-5 py-3 text-xs text-white/40 tabular-nums">
                      {r.ip ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-xs text-white/50 tabular-nums whitespace-nowrap">
                      {fmt(r.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full ${STATUS_BADGE[st]}`}>
                        {STATUS_LABEL[st]}
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
        params={{ tab: "staff", q, tenantId }}
      />
    </>
  );
}

async function CustomerTab({
  q,
  page,
  pageSize,
  skip,
  take,
}: {
  q: string;
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}) {
  const where: Prisma.AccountWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.account.findMany({
      where,
      orderBy: { lastLoginAt: { sort: "desc", nulls: "last" } },
      skip,
      take,
      select: {
        id: true,
        name: true,
        phone: true,
        lastLoginAt: true,
        createdAt: true,
        _count: { select: { devices: true } },
      },
    }),
    prisma.account.count({ where }),
  ]);
  const meta = buildMeta(total, page, pageSize);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <SearchBox placeholder="Нэр, утас..." />
        <ResetFilters paramNames={["q"]} />
      </div>

      {rows.length === 0 ? (
        <Empty />
      ) : (
        <div className="glass rounded-2xl overflow-hidden border border-white/[0.08]">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Хэрэглэгч", "Утас", "Сүүлд нэвтэрсэн", "Төхөөрөмж", "Бүртгүүлсэн"].map((h) => (
                  <th key={h} className="text-left text-xs text-white/30 font-medium px-5 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-5 py-3 text-sm text-white/85">
                    {r.name?.trim() || "—"}
                  </td>
                  <td className="px-5 py-3 text-sm text-white/60 tabular-nums">
                    {formatPhone(r.phone)}
                  </td>
                  <td className="px-5 py-3 text-xs text-white/50 tabular-nums whitespace-nowrap">
                    {fmt(r.lastLoginAt)}
                  </td>
                  <td className="px-5 py-3 text-sm text-white/60">
                    {r._count.devices}
                  </td>
                  <td className="px-5 py-3 text-xs text-white/40 tabular-nums whitespace-nowrap">
                    {fmt(r.createdAt)}
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
        params={{ tab: "customer", q }}
      />
    </>
  );
}

function Empty() {
  return (
    <div className="glass rounded-2xl p-10 border border-white/[0.08] text-center text-sm text-white/40">
      Бичлэг алга.
    </div>
  );
}
