import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import {
  confirmAppointment,
  markAppointmentNoShow,
  rejectAppointment,
} from "@/app/_actions/appointments";
import { FilterSelect, ResetFilters, SearchBox } from "@/app/_components/list-filters";
import { PageHeader, PrimaryLinkButton } from "@/app/_components/page-header";
import { Pagination } from "@/app/_components/pagination";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_BADGE,
  APPOINTMENT_STATUS_LABEL,
  type AppointmentStatus,
} from "@/lib/appointments";
import { requireUser } from "@/lib/auth";
import { branchScopeId, canCreate, canEdit, canView } from "@/lib/auth/roles";
import { formatPhone } from "@/lib/phone";
import { buildMeta, getPageInfo } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Цаг захиалга",
};

const STATUS_OPTIONS = APPOINTMENT_STATUSES.map((st) => ({
  value: st,
  label: APPOINTMENT_STATUS_LABEL[st],
}));

function formatDateTime(d: Date): string {
  return d.toLocaleString("mn-MN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    branchId?: string;
    page?: string;
  }>;
}) {
  const user = await requireUser();
  if (!canView(user, "appointments")) redirect("/dashboard");
  const canRespond = canEdit(user, "appointments");
  const canAdd = canCreate(user, "appointments");

  const {
    status: statusParam,
    q = "",
    branchId = "",
    page: pageParam,
  } = await searchParams;
  const status =
    statusParam && (APPOINTMENT_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as AppointmentStatus)
      : null;

  const scopeBranchId = branchScopeId(user);

  const where: Prisma.AppointmentWhereInput = {
    tenantId: user.tenantId,
    ...(status ? { status } : {}),
  };
  if (scopeBranchId) where.branchId = scopeBranchId;
  else if (branchId) where.branchId = branchId;
  if (q) {
    where.OR = [
      { account: { name: { contains: q, mode: "insensitive" } } },
      { account: { phone: { contains: q } } },
      { note: { contains: q, mode: "insensitive" } },
    ];
  }

  const { page, pageSize, skip, take } = getPageInfo(pageParam);
  const [appointments, filteredTotal, branches] = await Promise.all([
    prisma.appointment.findMany({
      where,
      orderBy: [{ requestedAt: "asc" }, { createdAt: "desc" }],
      skip,
      take,
      include: {
        account: { select: { name: true, phone: true } },
        customer: { select: { fullName: true, phone: true } },
        branch: { select: { name: true } },
        serviceOrder: { select: { id: true, number: true } },
      },
    }),
    prisma.appointment.count({ where }),
    prisma.branch.findMany({
      where: {
        tenantId: user.tenantId,
        ...(scopeBranchId ? { id: scopeBranchId } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const meta = buildMeta(filteredTotal, page, pageSize);

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Цаг захиалга"
        description="Онлайн болон утсаар орж ирсэн цагийн хүсэлтүүд."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/appointments/calendar"
              className="bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all px-4 py-2 rounded-lg text-sm text-white/70"
            >
              Календарь
            </Link>
            {canAdd ? (
              <PrimaryLinkButton href="/dashboard/appointments/new">
                Цаг бүртгэх
              </PrimaryLinkButton>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <SearchBox placeholder="Нэр, утас, тэмдэглэл..." />
        <FilterSelect
          paramName="status"
          placeholder="Бүх төлөв"
          options={STATUS_OPTIONS}
        />
        {!scopeBranchId && branches.length > 1 ? (
          <FilterSelect
            paramName="branchId"
            placeholder="Бүх салбар"
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />
        ) : null}
        <ResetFilters paramNames={["status", "q", "branchId"]} />
      </div>

      {appointments.length === 0 ? (
        <div className="glass rounded-2xl p-10 border border-white/[0.08] text-center text-sm text-white/40">
          Цаг захиалгын хүсэлт алга.
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden border border-white/[0.08]">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Үйлчлүүлэгч", "Салбар", "Хүссэн цаг", "Тэмдэглэл", "Төлөв", ""].map(
                  (h, i) => (
                    <th
                      key={i}
                      className="text-left text-xs text-white/30 font-medium px-5 py-3"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => {
                const orderHref = `/dashboard/orders/new?${new URLSearchParams({
                  customerId: a.customerId ?? "",
                  vehicleId: a.vehicleId ?? "",
                  branchId: a.branchId,
                  scheduledAt: a.requestedAt.toISOString(),
                  note: a.note ?? "",
                  appointmentId: a.id,
                }).toString()}`;
                // Онлайн бол Account-аас, утсаар бүртгэсэн бол Customer-аас.
                const displayName =
                  a.account?.name || a.customer?.fullName || "—";
                const displayPhone = a.account?.phone ?? a.customer?.phone ?? "";
                return (
                  <tr
                    key={a.id}
                    className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="text-sm font-medium text-white/85">
                        {displayName}
                      </div>
                      <div className="text-xs text-white/40 tabular-nums">
                        {displayPhone ? formatPhone(displayPhone) : "—"}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-white/60">
                      {a.branch.name}
                    </td>
                    <td className="px-5 py-4 text-sm text-white/70 tabular-nums whitespace-nowrap">
                      {formatDateTime(a.requestedAt)}
                    </td>
                    <td className="px-5 py-4 text-sm text-white/50 max-w-[220px] truncate">
                      {a.note || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full ${APPOINTMENT_STATUS_BADGE[a.status]}`}
                      >
                        {APPOINTMENT_STATUS_LABEL[a.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {a.status === "CONFIRMED" && a.serviceOrder ? (
                          <Link
                            href={`/dashboard/orders/${a.serviceOrder.id}`}
                            className="text-xs px-3 py-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-white/70 transition-colors whitespace-nowrap"
                          >
                            №{a.serviceOrder.number} харах
                          </Link>
                        ) : null}

                        {canRespond && a.status === "PENDING" ? (
                          <>
                            <form action={confirmAppointment}>
                              <input type="hidden" name="id" value={a.id} />
                              <button
                                type="submit"
                                className="text-xs px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-medium transition-colors"
                              >
                                Батлах
                              </button>
                            </form>
                            <form action={rejectAppointment}>
                              <input type="hidden" name="id" value={a.id} />
                              <button
                                type="submit"
                                className="text-xs px-3 py-1.5 rounded-lg border border-red-500/25 bg-red-500/10 hover:bg-red-500/20 text-red-300 font-medium transition-colors"
                              >
                                Татгалзах
                              </button>
                            </form>
                          </>
                        ) : null}

                        {canRespond &&
                        a.status === "CONFIRMED" &&
                        !a.serviceOrder ? (
                          <>
                            <Link
                              href={orderHref}
                              className="text-xs px-3 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-200 font-medium transition-colors whitespace-nowrap"
                            >
                              Захиалга үүсгэх →
                            </Link>
                            <form action={markAppointmentNoShow}>
                              <input type="hidden" name="id" value={a.id} />
                              <button
                                type="submit"
                                className="text-xs px-3 py-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-white/50 transition-colors"
                              >
                                Ирээгүй
                              </button>
                            </form>
                          </>
                        ) : null}
                      </div>
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
        params={{ status: status ?? "", q, branchId }}
      />
    </div>
  );
}
