import { Prisma } from "@/app/generated/prisma/client";
import { FilterSelect, SearchBox } from "@/app/_components/list-filters";
import { PageHeader } from "@/app/_components/page-header";
import { Pagination } from "@/app/_components/pagination";
import { requireSuperAdmin } from "@/lib/auth/system";
import { ownerKindFromRegnum } from "@/lib/hur_service";
import { buildMeta, getPageInfo } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Машинууд" };

export default async function SystemVehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tenantId?: string; page?: string }>;
}) {
  await requireSuperAdmin();
  const { q = "", tenantId = "", page: pageParam } = await searchParams;

  const where: Prisma.VehicleWhereInput = {
    ...(tenantId ? { tenantLinks: { some: { tenantId } } } : {}),
    ...(q
      ? {
          OR: [
            { plate: { contains: q, mode: "insensitive" } },
            { make: { contains: q, mode: "insensitive" } },
            { model: { contains: q, mode: "insensitive" } },
            { vin: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const { page, pageSize, skip, take } = getPageInfo(pageParam);
  const [vehicles, total, tenants] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        plate: true,
        make: true,
        model: true,
        year: true,
        colorName: true,
        fuelType: true,
        ownerRegnum: true,
        createdAt: true,
        _count: {
          select: { tenantLinks: true, serviceOrders: true, accountLinks: true },
        },
      },
    }),
    prisma.vehicle.count({ where }),
    prisma.tenant.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const meta = buildMeta(total, page, pageSize);

  return (
    <div className="p-6 sm:p-8 max-w-screen">
      <PageHeader
        title="Машинууд"
        description={`Платформ даяар бүртгэлтэй ${total} машин`}
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <SearchBox placeholder="Дугаар, марк, VIN-ээр хайх" />
        <FilterSelect
          paramName="tenantId"
          placeholder="Бүх байгууллага"
          searchable
          options={tenants.map((t) => ({ value: t.id, label: t.name }))}
        />
      </div>

      <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden">
        {vehicles.length === 0 ? (
          <div className="px-5 py-16 text-center text-[var(--oc-muted3)] text-sm">
            Хайлтад тохирох машин алга.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b border-[var(--oc-line2)]">
                  {[
                    "Машин",
                    "Дугаар",
                    "Өнгө",
                    "Эзэмшигч",
                    "Байгууллага",
                    "Захиалга",
                    "Бүртгүүлсэн",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs text-[var(--oc-muted4)] font-medium px-5 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-[var(--oc-line2)] last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="text-sm font-medium text-[var(--oc-ink2)]">
                        {v.make} {v.model}
                      </div>
                      <div className="text-xs text-[var(--oc-muted3)]">
                        {v.year ? `${v.year} он` : "—"}
                        {v.fuelType ? ` · ${v.fuelType}` : ""}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm font-mono font-medium text-[var(--oc-ink2)]">
                      {v.plate}
                    </td>
                    <td className="px-5 py-4 text-sm text-[var(--oc-muted)]">
                      {v.colorName ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-xs text-[var(--oc-muted)]">
                      {ownerKindFromRegnum(v.ownerRegnum) ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-sm text-[var(--oc-muted)]">
                      {v._count.tenantLinks}
                    </td>
                    <td className="px-5 py-4 text-sm text-[var(--oc-muted)]">
                      {v._count.serviceOrders}
                    </td>
                    <td className="px-5 py-4 text-xs text-[var(--oc-muted3)]">
                      {v.createdAt.toLocaleDateString("mn-MN")}
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
          params={{ q, tenantId }}
          tone="danger"
        />
      </div>
    </div>
  );
}
