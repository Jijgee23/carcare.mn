import { deleteCustomerAction } from "@/app/_actions/customers";
import { Prisma } from "@/app/generated/prisma/client";
import { ClickableRow } from "@/app/_components/clickable-row";
import { AddLinkButton } from "@/app/_components/landing-ops-ui";
import { ResetFilters, SearchBox } from "@/app/_components/list-filters";
import { Pagination } from "@/app/_components/pagination";
import { EmptyState } from "@/app/_components/page-header";
import { buildMeta, getPageInfo } from "@/lib/pagination";
import { customerLabel } from "@/lib/customers";
import { requireUser } from "@/lib/auth";
import { canCreate, canDelete, canView } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Үйлчлүүлэгчид",
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await requireUser();
  if (!canView(user, "customers")) redirect("/dashboard");
  const canAdd = canCreate(user, "customers");
  const canRemove = canDelete(user, "customers");

  const { q = "", page: pageParam } = await searchParams;
  const where: Prisma.CustomerWhereInput = { tenantId: user.tenantId };
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const { page, pageSize, skip, take } = getPageInfo(pageParam);
  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        _count: { select: { tenantVehicles: true, serviceOrders: true } },
      },
    }),
    prisma.customer.count({ where }),
  ]);
  const meta = buildMeta(total, page, pageSize);

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--oc-ink)]">Үйлчлүүлэгчид</h1>
          <p className="text-sm text-[var(--oc-muted3)] mt-1">
            Үйлчлүүлэгчдийн харилцагч мэдээлэл, түүх · {total} үйлчлүүлэгч
          </p>
        </div>
        {canAdd ? (
          <AddLinkButton href="/dashboard/customers/new">Үйлчлүүлэгч нэмэх</AddLinkButton>
        ) : null}
      </div>

      {total === 0 ? (
        <EmptyState
          title="Үйлчлүүлэгч алга"
          description="Эхний үйлчлүүлэгчээ нэмж эхлээрэй."
          cta={
            canAdd ? (
              <AddLinkButton href="/dashboard/customers/new">Эхний үйлчлүүлэгч нэмэх</AddLinkButton>
            ) : null
          }
        />
      ) : (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-[var(--oc-line)]">
            <SearchBox placeholder="Нэр, утас, имэйлээр хайх" />
            <ResetFilters paramNames={["q"]} />
            <span className="ml-auto font-plex-mono text-xs text-[var(--oc-muted3)] whitespace-nowrap">
              {customers.length} / {total} харагдаж байна
            </span>
          </div>

          {customers.length === 0 ? (
            <p className="text-sm text-[var(--oc-muted3)] py-16 text-center">
              Хайлтад тохирох үйлчлүүлэгч олдсонгүй.
            </p>
          ) : (
            <div className="overflow-auto flex-1 min-h-0">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-[var(--oc-line)]">
                    {[
                      "Үйлчлүүлэгч",
                      "Утас",
                      "Имэйл",
                      "Машин",
                      "Захиалга",
                      "Огноо",
                      "Үйлдэл",
                    ].map((h) => (
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
                  {customers.map((c) => (
                    <ClickableRow
                      key={c.id}
                      href={`/dashboard/customers/${c.id}`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full border border-[var(--oc-line)] bg-[var(--oc-panel2)] flex items-center justify-center text-xs font-bold text-[var(--oc-ink2)] shrink-0">
                            {customerLabel(c)[0]?.toUpperCase() ?? "?"}
                          </div>
                          <span className="text-sm font-medium text-[var(--oc-ink)]">
                            {customerLabel(c)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-plex-mono text-sm text-[var(--oc-muted2)]">
                        {c.phone}
                      </td>
                      <td className="px-5 py-4 text-sm text-[var(--oc-muted2)]">
                        {c.email ?? "—"}
                      </td>
                      <td className="px-5 py-4 font-plex-mono text-sm text-[var(--oc-ink2)]">
                        {c._count.tenantVehicles}
                      </td>
                      <td className="px-5 py-4 font-plex-mono text-sm text-[var(--oc-ink2)]">
                        {c._count.serviceOrders}
                      </td>
                      <td className="px-5 py-4 font-plex-mono text-xs text-[var(--oc-muted3)] whitespace-nowrap">
                        {c.createdAt.toLocaleDateString("mn-MN")}
                      </td>
                      <td className="px-5 py-4">
                        {canRemove ? (
                          <div className="flex items-center justify-end">
                            <form action={deleteCustomerAction}>
                              <input type="hidden" name="id" value={c.id} />
                              <button
                                type="submit"
                                className="text-xs text-red-400 hover:text-red-300 light:text-red-600 light:hover:text-red-700 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-500/10"
                              >
                                Устгах
                              </button>
                            </form>
                          </div>
                        ) : null}
                      </td>
                    </ClickableRow>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-[var(--oc-line)] font-plex-mono text-xs text-[var(--oc-muted3)]">
            <span>
              {customers.length} / {total} харагдаж байна
            </span>
          </div>
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            params={{ q }}
          />
        </div>
      )}
    </div>
  );
}
