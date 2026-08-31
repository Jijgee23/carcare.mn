import { redirect } from "next/navigation";
import { deleteRoleAction } from "@/app/_actions/roles";
import { ClickableRow } from "@/app/_components/clickable-row";
import {
  AddLinkButton,
  BtnLink,
  Chip,
  StatCell,
  StatGrid,
  TagChip,
} from "@/app/_components/landing-ops-ui";
import { EmptyState } from "@/app/_components/page-header";
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
  const [roles, total, activeCount] = await Promise.all([
    prisma.role.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      skip,
      take,
      include: { _count: { select: { users: true } } },
    }),
    prisma.role.count({ where }),
    prisma.role.count({ where: { ...where, isActive: true } }),
  ]);
  const meta = buildMeta(total, page, pageSize);

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--oc-ink)]">Хэрэглэгчийн үүргүүд</h1>
          <p className="text-sm text-[var(--oc-muted3)] mt-1">
            Байгууллагынхаа онцлогт тааруулан үүрэг үүсгэж, эрхүүдийг сонгоно. Ажилтан үүсгэх үед эдгээрээс сонгоно.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BtnLink href="/dashboard/employees" variant="ghost">
            ← Ажилтнууд
          </BtnLink>
          <AddLinkButton href="/dashboard/employees/roles/new">Үүрэг үүсгэх</AddLinkButton>
        </div>
      </div>

      <StatGrid cols={3}>
        <StatCell label="Нийт үүрэг" value={total} />
        <StatCell label="Идэвхтэй" value={activeCount} tone="ok" />
        <StatCell label="Идэвхгүй" value={total - activeCount} />
      </StatGrid>

      {total === 0 ? (
        <EmptyState
          title="Үүрэг үүсээгүй"
          description="Ажилтан үүсгэхээс өмнө хамгийн багадаа нэг үүрэг үүсгэх шаардлагатай."
          cta={
            <AddLinkButton href="/dashboard/employees/roles/new">
              Эхний үүргээ үүсгэх
            </AddLinkButton>
          }
        />
      ) : (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-[var(--oc-line)]">
                  {["Нэр", "Эрхүүд", "Ажилтан", "Төлөв", "Үйлдэл"].map((h) => (
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
                {roles.map((r) => (
                  <ClickableRow
                    key={r.id}
                    href={`/dashboard/employees/roles/${r.id}`}
                  >
                    <td className="px-5 py-4">
                      <div className="text-sm font-medium text-[var(--oc-ink)]">
                        {r.name}
                      </div>
                      {r.description ? (
                        <div className="text-xs text-[var(--oc-muted3)] mt-0.5 max-w-md truncate">
                          {r.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {r.permissions.length === 0 ? (
                          <span className="text-xs text-[var(--oc-muted4)]">—</span>
                        ) : (
                          r.permissions.slice(0, 5).map((p) => (
                            <TagChip key={p}>{permissionLabel(p)}</TagChip>
                          ))
                        )}
                        {r.permissions.length > 5 ? (
                          <span className="font-plex-mono text-[10px] text-[var(--oc-muted3)]">
                            +{r.permissions.length - 5}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-plex-mono text-sm text-[var(--oc-ink2)]">
                      {r._count.users}
                    </td>
                    <td className="px-5 py-4">
                      <Chip tone={r.isActive ? "ok" : "neutral"}>
                        {r.isActive ? "Идэвхтэй" : "Идэвхгүй"}
                      </Chip>
                    </td>
                    <td className="px-5 py-4">
                      {r._count.users === 0 ? (
                        <div className="flex items-center justify-end">
                          <form action={deleteRoleAction}>
                            <input type="hidden" name="id" value={r.id} />
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
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} />
        </div>
      )}
    </div>
  );
}
