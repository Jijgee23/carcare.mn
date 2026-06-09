import { deleteCustomerAction } from "@/app/_actions/customers";
import { Prisma } from "@/app/generated/prisma/client";
import { ClickableRow } from "@/app/_components/clickable-row";
import { ResetFilters, SearchBox } from "@/app/_components/list-filters";
import { Pagination } from "@/app/_components/pagination";
import {
  EmptyState,
  PageHeader,
  PrimaryLinkButton,
} from "@/app/_components/page-header";
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
        _count: { select: { vehicles: true, serviceOrders: true } },
      },
    }),
    prisma.customer.count({ where }),
  ]);
  const meta = buildMeta(total, page, pageSize);

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Үйлчлүүлэгчид"
        description="Үйлчлүүлэгчдийн харилцагч мэдээлэл, түүх"
        actions={
          canAdd ? (
            <PrimaryLinkButton href="/dashboard/customers/new">
              Үйлчлүүлэгч нэмэх
            </PrimaryLinkButton>
          ) : null
        }
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "1rem",
        }}
      >
        <SearchBox placeholder="Нэр, утас, имэйлээр хайх" />
        <ResetFilters paramNames={["q"]} />
      </div>

      {customers.length === 0 ? (
        <EmptyState
          title={q ? "Үйлчлүүлэгч олдсонгүй" : "Үйлчлүүлэгч алга"}
          description={
            q
              ? "Шүүлтүүрээ цэвэрлэж дахин үзнэ үү."
              : "Эхний үйлчлүүлэгчээ нэмж эхлээрэй."
          }
          cta={
            canAdd ? (
              <PrimaryLinkButton href="/dashboard/customers/new">
                Эхний үйлчлүүлэгч нэмэх
              </PrimaryLinkButton>
            ) : null
          }
        />
      ) : (
        <div className="glass rounded-2xl overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {[
                    "Үйлчлүүлэгч",
                    "Утас",
                    "Имэйл",
                    "Машин",
                    "Захиалга",
                    "Огноо",
                    "",
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
                {customers.map((c) => (
                  <ClickableRow
                    key={c.id}
                    href={`/dashboard/customers/${c.id}`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500/30 to-blue-500/30 flex items-center justify-center text-xs font-bold text-violet-300 shrink-0">
                          {customerLabel(c)[0]?.toUpperCase() ?? "?"}
                        </div>
                        <span className="text-sm font-medium text-white/90">
                          {customerLabel(c)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-white/50">
                      {c.phone}
                    </td>
                    <td className="px-5 py-4 text-sm text-white/50">
                      {c.email ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-sm text-white/60">
                      {c._count.vehicles}
                    </td>
                    <td className="px-5 py-4 text-sm text-white/60">
                      {c._count.serviceOrders}
                    </td>
                    <td className="px-5 py-4 text-xs text-white/30">
                      {c.createdAt.toLocaleDateString("mn-MN")}
                    </td>
                    <td className="px-5 py-4">
                      {canRemove ? (
                        <div className="flex items-center justify-end">
                          <form action={deleteCustomerAction}>
                            <input type="hidden" name="id" value={c.id} />
                            <button
                              type="submit"
                              className="text-xs text-red-400 hover:text-red-300 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-500/10"
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
