import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import {
  confirmAppointment,
  markAppointmentNoShow,
  rejectAppointment,
} from "@/app/_actions/appointments";
import { AddLinkButton, Btn, BtnLink } from "@/app/_components/landing-ops-ui";
import { FilterSelect, ResetFilters, SearchBox } from "@/app/_components/list-filters";
import { EmptyState } from "@/app/_components/page-header";
import { Pagination } from "@/app/_components/pagination";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_BADGE,
  APPOINTMENT_STATUS_LABEL,
  type AppointmentStatus,
} from "@/lib/appointments";
import { requireUser } from "@/lib/auth";
import { branchScopeId, canCreate, canEdit, canView } from "@/lib/auth/roles";
import { customerLabel } from "@/lib/customers";
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
    hour12: false,
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
        category: { select: { name: true } },
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
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--oc-ink)]">Цаг захиалга</h1>
          <p className="text-sm text-[var(--oc-muted3)] mt-1">
            Онлайн болон утсаар орж ирсэн цагийн хүсэлтүүд.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BtnLink href="/dashboard/appointments/calendar" variant="ghost">
            Календарь
          </BtnLink>
          {canAdd ? (
            <AddLinkButton href="/dashboard/appointments/new">Цаг бүртгэх</AddLinkButton>
          ) : null}
        </div>
      </div>

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
        <EmptyState
          title="Цаг захиалгын хүсэлт алга"
          description="Одоогоор цаг захиалгын хүсэлт ирээгүй байна."
        />
      ) : (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-[var(--oc-line)]">
                  {["Үйлчлүүлэгч", "Салбар", "Хүссэн цаг", "Тэмдэглэл", "Төлөв", "Үйлдэл"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)] font-medium px-5 py-3"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--oc-line)]">
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
                  // Нэргүй бол placeholder биш — утсаар нь харуулна (customerLabel).
                  const apptPhone = a.account?.phone ?? a.customer?.phone ?? "";
                  const displayName = customerLabel({
                    fullName: a.account?.name ?? a.customer?.fullName,
                    phone: apptPhone,
                  });
                  // displayName өөрөө утас болсон бол доор давхардуулахгүй.
                  const phoneLine =
                    apptPhone && displayName !== formatPhone(apptPhone)
                      ? formatPhone(apptPhone)
                      : null;
                  return (
                    <tr
                      key={a.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="text-sm font-medium text-[var(--oc-ink)]">
                          {displayName}
                        </div>
                        {phoneLine ? (
                          <div className="font-plex-mono text-xs text-[var(--oc-muted3)]">
                            {phoneLine}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-sm text-[var(--oc-muted2)]">
                        {a.branch.name}
                        {a.category ? (
                          <span className="block text-xs text-[var(--oc-muted3)] mt-0.5">
                            {a.category.name}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 font-plex-mono text-sm text-[var(--oc-muted2)] whitespace-nowrap">
                        {formatDateTime(a.requestedAt)}
                      </td>
                      <td className="px-5 py-4 text-sm text-[var(--oc-muted3)] max-w-[220px] truncate">
                        {a.note || "—"}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`font-plex-mono text-[11px] px-2.5 py-1 rounded-full ${APPOINTMENT_STATUS_BADGE[a.status]}`}
                        >
                          {APPOINTMENT_STATUS_LABEL[a.status]}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {a.status === "CONFIRMED" && a.serviceOrder ? (
                            <BtnLink
                              href={`/dashboard/orders/${a.serviceOrder.id}`}
                              variant="ghost"
                              size="sm"
                              className="whitespace-nowrap"
                            >
                              №{a.serviceOrder.number} харах
                            </BtnLink>
                          ) : null}

                          {canRespond && a.status === "PENDING" ? (
                            <>
                              <form action={confirmAppointment}>
                                <input type="hidden" name="id" value={a.id} />
                                <button
                                  type="submit"
                                  className="text-xs px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 light:bg-emerald-100 light:hover:bg-emerald-200 light:border-emerald-300 light:text-emerald-700 font-medium transition-colors"
                                >
                                  Батлах
                                </button>
                              </form>
                              <form action={rejectAppointment}>
                                <input type="hidden" name="id" value={a.id} />
                                <button
                                  type="submit"
                                  className="text-xs px-3 py-1.5 rounded-lg border border-red-500/25 bg-red-500/10 hover:bg-red-500/20 text-red-400 light:text-red-700 font-medium transition-colors"
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
                              <BtnLink
                                href={orderHref}
                                size="sm"
                                className="whitespace-nowrap"
                              >
                                Захиалга үүсгэх →
                              </BtnLink>
                              <form action={markAppointmentNoShow}>
                                <input type="hidden" name="id" value={a.id} />
                                <Btn type="submit" variant="ghost" size="sm">
                                  Ирээгүй
                                </Btn>
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
