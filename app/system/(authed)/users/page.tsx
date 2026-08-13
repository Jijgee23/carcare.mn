import { Prisma } from "@/app/generated/prisma/client";
import { FilterSelect, SearchBox } from "@/app/_components/list-filters";
import { PageHeader } from "@/app/_components/page-header";
import { Pagination } from "@/app/_components/pagination";
import { requireSuperAdmin } from "@/lib/auth/system";
import { buildMeta, getPageInfo } from "@/lib/pagination";
import { formatPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Хэрэглэгчид" };

export default async function SystemUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    tenantId?: string;
    status?: string;
    page?: string;
  }>;
}) {
  await requireSuperAdmin();
  const { q = "", tenantId = "", status = "", page: pageParam } =
    await searchParams;

  const where: Prisma.UserWhereInput = {
    ...(tenantId ? { tenantId } : {}),
    ...(status === "owner" ? { isOwner: true } : {}),
    ...(status === "active" ? { isActive: true } : {}),
    ...(status === "inactive" ? { isActive: false } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };

  const { page, pageSize, skip, take } = getPageInfo(pageParam);
  const [users, total, tenants] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        isOwner: true,
        isActive: true,
        createdAt: true,
        tenant: { select: { id: true, name: true } },
        role: { select: { name: true } },
      },
    }),
    prisma.user.count({ where }),
    prisma.tenant.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const meta = buildMeta(total, page, pageSize);

  return (
    <div className="p-6 sm:p-8 max-w-screen">
      <PageHeader
        title="Хэрэглэгчид"
        description={`Платформ даяар ${total} ажилтан`}
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <SearchBox placeholder="Нэр, имэйл, утсаар хайх" />
        <FilterSelect
          paramName="tenantId"
          placeholder="Бүх байгууллага"
          searchable
          options={tenants.map((t) => ({ value: t.id, label: t.name }))}
        />
        <FilterSelect
          paramName="status"
          placeholder="Бүх төлөв"
          options={[
            { value: "owner", label: "Админ (эзэн)" },
            { value: "active", label: "Идэвхтэй" },
            { value: "inactive", label: "Идэвхгүй" },
          ]}
        />
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        {users.length === 0 ? (
          <div className="px-5 py-16 text-center text-white/40 text-sm">
            Хайлтад тохирох хэрэглэгч алга.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {[
                    "Хэрэглэгч",
                    "Утас",
                    "Байгууллага",
                    "Үүрэг",
                    "Төлөв",
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
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="text-sm font-medium text-white/90">
                        {u.lastName} {u.firstName}
                      </div>
                      <div className="text-xs text-white/30">{u.email}</div>
                    </td>
                    <td className="px-5 py-4 text-sm text-white/60 tabular-nums">
                      {formatPhone(u.phone)}
                    </td>
                    <td className="px-5 py-4 text-sm text-white/70">
                      {u.tenant.name}
                    </td>
                    <td className="px-5 py-4 text-sm">
                      {u.isOwner ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/25 light:bg-violet-100 light:border-violet-300 light:text-violet-700">
                          Админ
                        </span>
                      ) : (
                        <span className="text-white/50 text-xs">
                          {u.role?.name ?? "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {u.isActive ? (
                        <span className="text-xs text-emerald-300 light:text-emerald-700">
                          Идэвхтэй
                        </span>
                      ) : (
                        <span className="text-xs text-white/40">Идэвхгүй</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-white/40">
                      {u.createdAt.toLocaleDateString("mn-MN")}
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
          params={{ q, tenantId, status }}
        />
      </div>
    </div>
  );
}
