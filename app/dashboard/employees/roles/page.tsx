import { redirect } from "next/navigation";
import Link from "next/link";
import { deleteRoleAction } from "@/app/_actions/roles";
import { ClickableRow } from "@/app/_components/clickable-row";
import {
  EmptyState,
  PageHeader,
  PrimaryLinkButton,
} from "@/app/_components/page-header";
import { Pagination } from "@/app/_components/pagination";
import { buildMeta, getPageInfo } from "@/lib/pagination";
import { requireUser } from "@/lib/auth";
import { permissionLabel } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Хэрэглэгчийн үүргүүд",
};

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const me = await requireUser();
  if (!me.isOwner) redirect("/dashboard/employees");

  const { page: pageParam } = await searchParams;
  const where = { tenantId: me.tenantId };
  const { page, pageSize, skip, take } = getPageInfo(pageParam);
  const [roles, total] = await Promise.all([
    prisma.role.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      skip,
      take,
      include: { _count: { select: { users: true } } },
    }),
    prisma.role.count({ where }),
  ]);
  const meta = buildMeta(total, page, pageSize);

  return (
    <div className="p-6 sm:p-8 max-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Хэрэглэгчийн үүргүүд"
        description="Байгууллагынхаа онцлогт тааруулан үүрэг үүсгэж, эрхүүдийг сонгоно. Ажилтан үүсгэх үед эдгээрээс сонгоно."
        actions={
          <div className="flex gap-2">
            <Link
              href="/dashboard/employees"
              className="bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all px-4 py-2 rounded-xl text-sm font-medium text-white/70"
            >
              ← Ажилтнууд
            </Link>
            <PrimaryLinkButton href="/dashboard/employees/roles/new">
              Үүрэг үүсгэх
            </PrimaryLinkButton>
          </div>
        }
      />

      {roles.length === 0 ? (
        <EmptyState
          title="Үүрэг үүсээгүй"
          description="Ажилтан үүсгэхээс өмнө хамгийн багадаа нэг үүрэг үүсгэх шаардлагатай."
          cta={
            <PrimaryLinkButton href="/dashboard/employees/roles/new">
              Эхний үүргээ үүсгэх
            </PrimaryLinkButton>
          }
        />
      ) : (
        <div className="glass rounded-2xl overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Нэр", "Эрхүүд", "Ажилтан", "Төлөв", ""].map((h) => (
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
                {roles.map((r) => (
                  <ClickableRow
                    key={r.id}
                    href={`/dashboard/employees/roles/${r.id}`}
                  >
                    <td className="px-5 py-4">
                      <div className="text-sm font-medium text-white/90">
                        {r.name}
                      </div>
                      {r.description ? (
                        <div className="text-xs text-white/40 mt-0.5 max-w-md truncate">
                          {r.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {r.permissions.length === 0 ? (
                          <span className="text-xs text-white/30">—</span>
                        ) : (
                          r.permissions.slice(0, 5).map((p) => (
                            <span
                              key={p}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-white/60 border border-white/[0.08]"
                            >
                              {permissionLabel(p)}
                            </span>
                          ))
                        )}
                        {r.permissions.length > 5 ? (
                          <span className="text-[10px] text-white/40">
                            +{r.permissions.length - 5}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-white/60">
                      {r._count.users}
                    </td>
                    <td className="px-5 py-4">
                      {r.isActive ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          Идэвхтэй
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.05] text-white/40 border border-white/[0.08]">
                          Идэвхгүй
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {r._count.users === 0 ? (
                        <div className="flex items-center justify-end">
                          <form action={deleteRoleAction}>
                            <input type="hidden" name="id" value={r.id} />
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
          />
        </div>
      )}
    </div>
  );
}
