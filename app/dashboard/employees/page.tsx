import { deleteEmployeeAction } from "@/app/_actions/employees";
import { ClickableRow } from "@/app/_components/clickable-row";
import {
  FilterSelect,
  ResetFilters,
  SearchBox,
} from "@/app/_components/list-filters";
import {
  EmptyState,
  PageHeader,
  PrimaryLinkButton,
} from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { canCreate, canDelete, canView } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Ажилтнууд",
};

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    roleId?: string;
    branchId?: string;
    status?: string;
  }>;
}) {
  const me = await requireUser();
  if (!canView(me, "employees")) redirect("/dashboard");
  const canAdd = canCreate(me, "employees");
  const canRemove = canDelete(me, "employees");

  const { q = "", roleId = "", branchId = "", status = "" } = await searchParams;

  const where: Prisma.UserWhereInput = { tenantId: me.tenantId };
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }
  if (roleId === "__owner__") {
    where.isOwner = true;
  } else if (roleId) {
    where.roleId = roleId;
  }
  if (branchId) where.branchId = branchId;

  const now = new Date();
  if (status === "active") {
    where.isActive = true;
    where.OR = [{ activeUntil: null }, { activeUntil: { gt: now } }];
  } else if (status === "inactive") {
    where.isActive = false;
  } else if (status === "expired") {
    where.activeUntil = { not: null, lte: now };
  } else if (status === "temp") {
    where.activeUntil = { not: null };
  }

  const [employees, branches, roles] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }],
      include: {
        branch: { select: { id: true, name: true } },
        role: { select: { id: true, name: true } },
      },
    }),
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
  ]);

  return (
    <div className="p-6 sm:p-8 max-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Ажилтнууд"
        description="Байгууллагын ажилтан, эрхүүдийг удирдах"
        actions={
          me.isOwner || canAdd ? (
            <div className="flex gap-2">
              {me.isOwner ? (
                <PrimaryLinkButton href="/dashboard/employees/roles">
                  Үүргүүд
                </PrimaryLinkButton>
              ) : null}
              {canAdd ? (
                <PrimaryLinkButton href="/dashboard/employees/new">
                  Ажилтан нэмэх
                </PrimaryLinkButton>
              ) : null}
            </div>
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
        <SearchBox placeholder="Нэр, имэйл, утсаар хайх" />
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
        <FilterSelect
          paramName="status"
          placeholder="Бүх төлөв"
          options={[
            { value: "active", label: "Идэвхтэй" },
            { value: "inactive", label: "Идэвхгүй" },
            { value: "temp", label: "Түр (огноотой)" },
            { value: "expired", label: "Хугацаа дууссан" },
          ]}
        />
        <ResetFilters paramNames={["q", "roleId", "branchId", "status"]} />
      </div>

      {employees.length === 0 ? (
        <EmptyState
          title="Ажилтан олдсонгүй"
          description="Шүүлтүүрээ өөрчилж үзнэ үү эсвэл шинээр нэмнэ үү."
          cta={
            canAdd ? (
              <PrimaryLinkButton href="/dashboard/employees/new">
                Эхний ажилтан нэмэх
              </PrimaryLinkButton>
            ) : null
          }
        />
      ) : (
        <div className="glass rounded-2xl overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {[
                    "Ажилтан",
                    "Имэйл",
                    "Утас",
                    "Үүрэг",
                    "Салбар",
                    "Төлөв",
                    "Хугацаа",
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
                {employees.map((u) => {
                  const initials = (
                    (u.firstName[0] ?? "") + (u.lastName[0] ?? "")
                  ).toUpperCase();
                  const isMe = u.id === me.id;
                  const roleName = u.isOwner ? "Админ" : (u.role?.name ?? "—");
                  const roleClass = u.isOwner
                    ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                    : u.role
                      ? "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                      : "bg-white/10 text-white/60 border border-white/15";
                  return (
                    <ClickableRow
                      key={u.id}
                      href={`/dashboard/employees/${u.id}`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500/30 to-blue-500/30 flex items-center justify-center text-xs font-bold text-violet-300 shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white/90">
                              {u.lastName} {u.firstName}
                              {isMe ? (
                                <span className="ml-1.5 text-[10px] text-violet-400">
                                  (та)
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-white/50">
                        {u.email}
                      </td>
                      <td className="px-5 py-4 text-sm text-white/50">
                        {u.phone}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full ${roleClass}`}>
                          {roleName}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-white/50">
                        {u.branch?.name ?? "—"}
                      </td>
                      <td className="px-5 py-4">
                        {(() => {
                          const expired =
                            u.activeUntil && u.activeUntil.getTime() <= Date.now();
                          if (!u.isActive) {
                            return (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.05] text-white/40 border border-white/[0.08]">
                                Идэвхгүй
                              </span>
                            );
                          }
                          if (expired) {
                            return (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30">
                                Хугацаа дууссан
                              </span>
                            );
                          }
                          if (u.activeUntil) {
                            return (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                Түр
                              </span>
                            );
                          }
                          return (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              Идэвхтэй
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-5 py-4 text-xs text-white/40 whitespace-nowrap">
                        {u.activeUntil
                          ? u.activeUntil.toLocaleDateString("mn-MN")
                          : "—"}
                      </td>
                      <td className="px-5 py-4">
                        {canRemove && !isMe && !u.isOwner ? (
                          <div className="flex items-center justify-end">
                            <form action={deleteEmployeeAction}>
                              <input type="hidden" name="id" value={u.id} />
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
