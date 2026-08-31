import {
  deleteEmployeeAction,
  toggleEmployeeActiveAction,
} from "@/app/_actions/employees";
import { ClickableRow } from "@/app/_components/clickable-row";
import {
  AddLinkButton,
  BtnLink,
  Chip,
  StatCell,
  StatGrid,
  TabLink,
  btnClass,
} from "@/app/_components/landing-ops-ui";
import {
  FilterSelect,
  ResetFilters,
  SearchBox,
} from "@/app/_components/list-filters";
import { EmptyState } from "@/app/_components/page-header";
import { Pagination } from "@/app/_components/pagination";
import { RowActionsMenu, RowMenuFormItem } from "@/app/_components/row-actions";
import { buildMeta, getPageInfo } from "@/lib/pagination";
import { requireUser } from "@/lib/auth";
import { canCreate, canDelete, canEdit, canView } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildEmployeeWhere, type EmployeeStatusFilter } from "./data";

export const metadata = {
  title: "Ажилтнууд",
};

const STATUS_TABS: {
  key: "all" | "active" | "inactive" | "temp" | "expired";
  label: string;
}[] = [
  { key: "all", label: "Бүгд" },
  { key: "active", label: "Идэвхтэй" },
  { key: "inactive", label: "Идэвхгүй" },
  { key: "temp", label: "Түр" },
  { key: "expired", label: "Хугацаа дууссан" },
];

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    roleId?: string;
    branchId?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const me = await requireUser();
  if (!canView(me, "employees")) redirect("/dashboard");
  const canAdd = canCreate(me, "employees");
  const canRemove = canDelete(me, "employees");
  const canModify = canEdit(me, "employees");

  const {
    q = "",
    roleId = "",
    branchId = "",
    status: statusParam,
    page: pageParam,
  } = await searchParams;
  const status: EmployeeStatusFilter =
    statusParam === "active" ||
    statusParam === "inactive" ||
    statusParam === "temp" ||
    statusParam === "expired"
      ? statusParam
      : undefined;

  const where = buildEmployeeWhere(me.tenantId, q, roleId, branchId, status);
  const { page, pageSize, skip, take } = getPageInfo(pageParam);

  const now = new Date();
  const [
    employees,
    filteredTotal,
    branches,
    roles,
    totalEmployees,
    activeEmployees,
    pendingActivation,
    expiredCount,
  ] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }],
      skip,
      take,
      include: {
        branch: { select: { id: true, name: true } },
        role: { select: { id: true, name: true } },
      },
    }),
    prisma.user.count({ where }),
    prisma.branch.findMany({
      where: { tenantId: me.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.role.findMany({
      where: { tenantId: me.tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.count({ where: { tenantId: me.tenantId } }),
    prisma.user.count({
      where: {
        tenantId: me.tenantId,
        isActive: true,
        OR: [{ activeUntil: null }, { activeUntil: { gt: now } }],
      },
    }),
    prisma.user.count({ where: { tenantId: me.tenantId, verified: false } }),
    prisma.user.count({
      where: { tenantId: me.tenantId, activeUntil: { not: null, lte: now } },
    }),
  ]);
  const meta = buildMeta(filteredTotal, page, pageSize);

  const filterParams = { q, roleId, branchId, status };
  const exportQs = new URLSearchParams(
    Object.entries(filterParams).filter(([, v]) => v) as [string, string][],
  ).toString();
  const exportHref = `/dashboard/employees/export${exportQs ? `?${exportQs}` : ""}`;

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--oc-ink)]">Ажилтнууд</h1>
          <p className="text-sm text-[var(--oc-muted3)] mt-1">
            Байгууллагын ажилтан, эрхүүдийг удирдах · {totalEmployees} ажилтан
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href={exportHref} className={btnClass("ghost", "md")}>
            Excel татах
          </a>
          {me.isOwner ? (
            <BtnLink href="/dashboard/employees/roles" variant="ghost">
              Үүргүүд
            </BtnLink>
          ) : null}
          {canAdd ? (
            <AddLinkButton href="/dashboard/employees/new">Ажилтан нэмэх</AddLinkButton>
          ) : null}
        </div>
      </div>

      <StatGrid cols={4}>
        <StatCell label="Нийт ажилтан" value={totalEmployees} />
        <StatCell label="Идэвхтэй" value={activeEmployees} tone="ok" />
        <StatCell label="Идэвхжээгүй" value={pendingActivation} tone="accent" />
        <StatCell label="Хугацаа дууссан" value={expiredCount} tone="warn" />
      </StatGrid>

      {totalEmployees === 0 ? (
        <EmptyState
          title="Ажилтан олдсонгүй"
          description="Шүүлтүүрээ өөрчилж үзнэ үү эсвэл шинээр нэмнэ үү."
          cta={
            canAdd ? (
              <AddLinkButton href="/dashboard/employees/new">Эхний ажилтан нэмэх</AddLinkButton>
            ) : null
          }
        />
      ) : (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-[var(--oc-line)]">
            <SearchBox placeholder="Нэр, имэйл, утсаар хайх" className="w-full sm:w-64" />
            <FilterSelect
              paramName="roleId"
              placeholder="Бүх үүрэг"
              options={[
                { value: "__owner__", label: "Админ" },
                ...roles.map((r) => ({ value: r.id, label: r.name })),
              ]}
            />
            <FilterSelect
              paramName="branchId"
              placeholder="Бүх салбар"
              options={branches.map((b) => ({ value: b.id, label: b.name }))}
            />
            <div className="flex items-center gap-1.5">
              {STATUS_TABS.map((tab) => {
                const active = (status ?? "all") === tab.key;
                const params: Record<string, string> = {};
                if (q) params.q = q;
                if (roleId) params.roleId = roleId;
                if (branchId) params.branchId = branchId;
                if (tab.key !== "all") params.status = tab.key;
                const qs = new URLSearchParams(params).toString();
                const href = `/dashboard/employees${qs ? `?${qs}` : ""}`;
                return (
                  <TabLink key={tab.key} href={href} active={active}>
                    {tab.label}
                  </TabLink>
                );
              })}
            </div>
            <ResetFilters paramNames={["q", "roleId", "branchId", "status"]} />
            <span className="ml-auto font-plex-mono text-xs text-[var(--oc-muted3)] whitespace-nowrap">
              {employees.length} / {filteredTotal} харагдаж байна
            </span>
          </div>

          {employees.length === 0 ? (
            <p className="text-sm text-[var(--oc-muted3)] py-16 text-center">
              Хайлтад тохирох ажилтан олдсонгүй.
            </p>
          ) : (
            <div className="overflow-auto flex-1 min-h-0">
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr className="border-b border-[var(--oc-line)]">
                    {[
                      "Ажилтан",
                      "Имэйл",
                      "Утас",
                      "Үүрэг",
                      "Салбар",
                      "Төлөв",
                      "Хугацаа",
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
                  {employees.map((u) => {
                    const initials = (
                      (u.lastName[0] ?? "") + (u.firstName[0] ?? "")
                    ).toUpperCase();
                    const isMe = u.id === me.id;
                    return (
                      <ClickableRow key={u.id} href={`/dashboard/employees/${u.id}`}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full border border-[var(--oc-line)] bg-[var(--oc-panel2)] flex items-center justify-center text-xs font-bold text-[var(--oc-ink2)] shrink-0">
                              {initials}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-[var(--oc-ink)] flex items-center gap-1.5">
                                {u.lastName} {u.firstName}
                                {isMe ? (
                                  <span className="font-plex-mono text-[10px] text-[var(--oc-accent)]">
                                    (та)
                                  </span>
                                ) : null}
                                {!u.verified ? (
                                  <span title="Ажилтан анхны нэвтрэлт хийж нууц үгээ үүсгээгүй байна.">
                                    <Chip tone="accent" bordered>идэвхжээгүй</Chip>
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-plex-mono text-sm text-[var(--oc-muted2)]">
                          {u.email}
                        </td>
                        <td className="px-5 py-4 font-plex-mono text-sm text-[var(--oc-muted2)] whitespace-nowrap">
                          {u.phone}
                        </td>
                        <td className="px-5 py-4">
                          {u.isOwner ? (
                            <Chip tone="accent">Админ</Chip>
                          ) : u.role ? (
                            <Chip tone="neutral" bordered>{u.role.name}</Chip>
                          ) : (
                            <span className="text-xs text-[var(--oc-muted4)]">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-sm text-[var(--oc-muted2)]">
                          {u.branch?.name ?? "—"}
                        </td>
                        <td className="px-5 py-4">
                          <StatusPill isActive={u.isActive} activeUntil={u.activeUntil} />
                        </td>
                        <td className="px-5 py-4 font-plex-mono text-xs text-[var(--oc-muted3)] whitespace-nowrap">
                          {u.activeUntil ? u.activeUntil.toLocaleDateString("mn-MN") : "—"}
                        </td>
                        <td className="px-5 py-4">
                          <EmployeeRowActions
                            employee={u}
                            isMe={isMe}
                            canModify={canModify}
                            canRemove={canRemove}
                          />
                        </td>
                      </ClickableRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-[var(--oc-line)] font-plex-mono text-xs text-[var(--oc-muted3)]">
            <span>
              {employees.length} / {filteredTotal} харагдаж байна
            </span>
            <span>
              Идэвхтэй {activeEmployees} · Идэвхжээгүй {pendingActivation}
            </span>
          </div>
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            params={filterParams}
          />
        </div>
      )}
    </div>
  );
}

function StatusPill({
  isActive,
  activeUntil,
}: {
  isActive: boolean;
  activeUntil: Date | null;
}) {
  const expired = activeUntil != null && activeUntil.getTime() <= Date.now();
  if (!isActive) {
    return <Chip tone="neutral">Идэвхгүй</Chip>;
  }
  if (expired) {
    return <Chip tone="danger">Хугацаа дууссан</Chip>;
  }
  if (activeUntil) {
    return <Chip tone="accent">Түр</Chip>;
  }
  return <Chip tone="ok">Идэвхтэй</Chip>;
}

function EmployeeRowActions({
  employee,
  isMe,
  canModify,
  canRemove,
}: {
  employee: { id: string; lastName: string; firstName: string; isActive: boolean; isOwner: boolean };
  isMe: boolean;
  canModify: boolean;
  canRemove: boolean;
}) {
  const showToggle = canModify && !isMe && !employee.isOwner;
  const showDelete = canRemove && !isMe && !employee.isOwner;
  if (!showToggle && !showDelete) return null;

  return (
    <RowActionsMenu>
      {showToggle ? (
        <RowMenuFormItem
          action={toggleEmployeeActiveAction}
          hidden={{ id: employee.id, isActive: employee.isActive ? "" : "on" }}
        >
          {employee.isActive ? "Идэвхгүй болгох" : "Идэвхжүүлэх"}
        </RowMenuFormItem>
      ) : null}
      {showDelete ? (
        <RowMenuFormItem
          action={deleteEmployeeAction}
          hidden={{ id: employee.id }}
          confirmMessage={`"${employee.lastName} ${employee.firstName}" ажилтныг устгах уу?`}
          destructive
        >
          Устгах
        </RowMenuFormItem>
      ) : null}
    </RowActionsMenu>
  );
}
