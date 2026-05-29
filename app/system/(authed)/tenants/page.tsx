import Link from "next/link";
import { PageHeader } from "@/app/_components/page-header";
import { requireSuperAdmin } from "@/lib/auth/system";
import { formatTugrik } from "@/lib/orders";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Байгууллагууд",
};

const PLAN_BADGE: Record<string, string> = {
  FREE: "bg-zinc-500/15 text-zinc-300 border border-zinc-500/25",
  BUSINESS: "bg-violet-500/15 text-violet-300 border border-violet-500/25",
  ENTERPRISE: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25",
};

export default async function SystemTenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  await requireSuperAdmin();
  const { filter, q } = await searchParams;

  const where = {
    ...(filter === "suspended" ? { suspended: true } : {}),
    ...(filter === "active" ? { suspended: false } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { registerNumber: { contains: q } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const tenants = await prisma.tenant.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          users: true,
          branches: true,
          customers: true,
          serviceOrders: true,
        },
      },
    },
  });

  // Тус бүрийн орлогыг тооцох
  const ids = tenants.map((t) => t.id);
  const revenueAgg = await prisma.serviceOrder.groupBy({
    by: ["tenantId"],
    where: { tenantId: { in: ids }, status: "COMPLETED" },
    _sum: { totalAmount: true },
  });
  const revenueByTenant = Object.fromEntries(
    revenueAgg.map((r) => [
      r.tenantId,
      Number.parseFloat(r._sum.totalAmount?.toString() ?? "0"),
    ]),
  );

  return (
    <div className="p-6 sm:p-8 max-w-7xl">
      <PageHeader
        title="Байгууллагууд"
        description={`Платформ дээр бүртгэлтэй ${tenants.length} байгууллага`}
      />

      <div className="glass rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {(
              [
                { v: "", label: "Бүгд" },
                { v: "active", label: "Идэвхтэй" },
                { v: "suspended", label: "Зогссон" },
              ] as const
            ).map((f) => {
              const href =
                "/system/tenants" +
                (f.v ? `?filter=${f.v}` : "") +
                (q ? `${f.v ? "&" : "?"}q=${encodeURIComponent(q)}` : "");
              const active = (filter ?? "") === f.v;
              return (
                <Link
                  key={f.v || "all"}
                  href={href}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    active
                      ? "bg-red-500/20 text-red-200 border border-red-500/30"
                      : "text-white/40 hover:text-white/70 border border-white/10 hover:border-white/20"
                  }`}
                >
                  {f.label}
                </Link>
              );
            })}
          </div>

          <form
            className="ml-auto flex items-center gap-2"
            action="/system/tenants"
          >
            {filter ? (
              <input type="hidden" name="filter" value={filter} />
            ) : null}
            <input
              type="text"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Нэр, регистр, имэйл..."
              className="auth-input !py-1.5 !text-xs w-56"
            />
            <button
              type="submit"
              className="text-xs bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 transition-colors px-3 py-1.5 rounded-lg font-medium"
            >
              Хайх
            </button>
          </form>
        </div>

        {tenants.length === 0 ? (
          <div className="px-5 py-16 text-center text-white/40 text-sm">
            Хайлтад тохирох байгууллага алга.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {[
                    "Байгууллага",
                    "Регистр",
                    "Багц",
                    "Салбар",
                    "Ажилтан",
                    "Захиалга",
                    "Орлого",
                    "Статус",
                    "Бүртгүүлсэн",
                  ].map((h) => (
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
                {tenants.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/system/tenants/${t.id}`}
                        className="flex items-center gap-3 group"
                      >
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500/30 to-violet-500/30 flex items-center justify-center text-sm font-bold text-red-300 shrink-0">
                          {t.name[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white/90 group-hover:text-red-200 transition-colors">
                            {t.name}
                          </div>
                          <div className="text-xs text-white/30">
                            {t.email}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-xs font-mono text-white/60">
                      {t.registerNumber}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          PLAN_BADGE[t.plan] ?? PLAN_BADGE.FREE
                        }`}
                      >
                        {t.plan}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-white/60">
                      {t._count.branches}
                    </td>
                    <td className="px-5 py-4 text-sm text-white/60">
                      {t._count.users}
                    </td>
                    <td className="px-5 py-4 text-sm text-white/60">
                      {t._count.serviceOrders}
                    </td>
                    <td className="px-5 py-4 text-sm text-white/80">
                      {formatTugrik(revenueByTenant[t.id] ?? 0)}
                    </td>
                    <td className="px-5 py-4">
                      {t.suspended ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                          Зогссон
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                          Идэвхтэй
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-white/40">
                      {t.createdAt.toLocaleDateString("mn-MN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
