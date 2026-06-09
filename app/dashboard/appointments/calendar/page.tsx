import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { FilterSelect } from "@/app/_components/list-filters";
import { PageHeader } from "@/app/_components/page-header";
import {
  APPOINTMENT_STATUS_BADGE,
  APPOINTMENT_STATUS_LABEL,
} from "@/lib/appointments";
import {
  WEEKDAY_LABELS,
  dateKey,
  resolveCalendar,
} from "@/lib/appointments-calendar";
import { requireUser } from "@/lib/auth";
import { branchScopeId, canView } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Цаг захиалгын календарь",
};

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" });
}

export default async function AppointmentsCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    interval?: string;
    anchor?: string;
    branchId?: string;
  }>;
}) {
  const user = await requireUser();
  if (!canView(user, "appointments")) redirect("/dashboard");

  const sp = await searchParams;
  const cal = resolveCalendar(sp);
  const scopeBranchId = branchScopeId(user);
  const branchId = scopeBranchId ?? (sp.branchId || "");

  const where: Prisma.AppointmentWhereInput = {
    tenantId: user.tenantId,
    status: { notIn: ["CANCELLED", "REJECTED"] },
    requestedAt: { gte: cal.rangeStart, lt: cal.rangeEnd },
  };
  if (branchId) where.branchId = branchId;

  const [appointments, branches] = await Promise.all([
    prisma.appointment.findMany({
      where,
      orderBy: { requestedAt: "asc" },
      include: {
        account: { select: { name: true } },
        customer: { select: { fullName: true } },
        branch: { select: { name: true } },
      },
    }),
    prisma.branch.findMany({
      where: {
        tenantId: user.tenantId,
        ...(scopeBranchId ? { id: scopeBranchId } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  type Appt = (typeof appointments)[number];
  const byDay = new Map<string, Appt[]>();
  for (const a of appointments) {
    const k = dateKey(a.requestedAt);
    const arr = byDay.get(k);
    if (arr) arr.push(a);
    else byDay.set(k, [a]);
  }

  const apptName = (a: Appt) =>
    a.account?.name || a.customer?.fullName || "Зочин";

  // Навигаци / toggle линкийн query-г бүрдүүлэгч.
  const hrefWith = (over: { interval?: string; anchor?: string }) => {
    const p = new URLSearchParams();
    if (sp.branchId) p.set("branchId", sp.branchId);
    p.set("interval", over.interval ?? cal.interval);
    const anchor = over.anchor ?? sp.anchor;
    if (anchor) p.set("anchor", anchor);
    return `/dashboard/appointments/calendar?${p.toString()}`;
  };

  const navBtn =
    "px-3 py-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-sm text-white/70 transition-colors";

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Цаг захиалгын календарь"
        description="Аль салбарт, хэзээ цаг захиалагдсан, аль нь сул болохыг харна."
        actions={
          <Link
            href="/dashboard/appointments"
            className="bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all px-4 py-2 rounded-lg text-sm text-white/70"
          >
            Жагсаалт
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* 7 хоног / Сар toggle */}
        <div className="flex rounded-lg border border-white/[0.1] overflow-hidden">
          <Link
            href={hrefWith({ interval: "week" })}
            className={`px-3 py-1.5 text-sm transition-colors ${
              cal.interval === "week"
                ? "bg-violet-600/30 text-violet-200"
                : "text-white/60 hover:bg-white/[0.06]"
            }`}
          >
            7 хоног
          </Link>
          <Link
            href={hrefWith({ interval: "month" })}
            className={`px-3 py-1.5 text-sm transition-colors border-l border-white/[0.1] ${
              cal.interval === "month"
                ? "bg-violet-600/30 text-violet-200"
                : "text-white/60 hover:bg-white/[0.06]"
            }`}
          >
            Сар
          </Link>
        </div>

        {/* Prev / Өнөөдөр / Next */}
        <div className="flex items-center gap-1.5">
          <Link href={hrefWith({ anchor: cal.prevAnchorKey })} className={navBtn}>
            ‹
          </Link>
          <Link href={hrefWith({ anchor: cal.todayKey })} className={navBtn}>
            Өнөөдөр
          </Link>
          <Link href={hrefWith({ anchor: cal.nextAnchorKey })} className={navBtn}>
            ›
          </Link>
        </div>

        <span className="text-sm font-medium text-white/80 px-1">
          {cal.label}
        </span>

        <div className="ml-auto">
          {!scopeBranchId && branches.length > 1 ? (
            <FilterSelect
              paramName="branchId"
              placeholder="Бүх салбар"
              options={branches.map((b) => ({ value: b.id, label: b.name }))}
            />
          ) : null}
        </div>
      </div>

      {cal.interval === "week" ? (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
          {cal.days.map((d) => {
            const items = byDay.get(d.key) ?? [];
            const booked = items.length > 0;
            return (
              <div
                key={d.key}
                className={`glass rounded-xl border min-h-[8rem] p-2.5 flex flex-col gap-1.5 ${
                  d.isToday
                    ? "border-violet-500/40"
                    : booked
                      ? "border-white/[0.12]"
                      : "border-white/[0.05]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">
                    {WEEKDAY_LABELS[(d.date.getDay() + 6) % 7]}
                  </span>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      d.isToday ? "text-violet-300" : "text-white/70"
                    }`}
                  >
                    {d.date.getDate()}
                  </span>
                </div>

                {booked ? (
                  items.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-lg bg-white/[0.04] border border-white/[0.06] px-2 py-1.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-white/80 tabular-nums">
                          {fmtTime(a.requestedAt)}
                        </span>
                        <span
                          className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full ${APPOINTMENT_STATUS_BADGE[a.status]}`}
                        >
                          {APPOINTMENT_STATUS_LABEL[a.status]}
                        </span>
                      </div>
                      <div className="text-xs text-white/55 truncate mt-0.5">
                        {apptName(a)}
                      </div>
                      {!branchId ? (
                        <div className="text-[10px] text-white/35 truncate">
                          {a.branch.name}
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="flex-1 flex items-center justify-center text-xs text-white/25">
                    Сул
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass rounded-2xl border border-white/[0.08] overflow-hidden">
          <div className="grid grid-cols-7 border-b border-white/[0.06]">
            {WEEKDAY_LABELS.map((w) => (
              <div
                key={w}
                className="text-center text-xs text-white/30 font-medium py-2"
              >
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cal.days.map((d) => {
              const items = byDay.get(d.key) ?? [];
              const booked = items.length > 0;
              return (
                <Link
                  key={d.key}
                  href={hrefWith({ interval: "week", anchor: d.key })}
                  className={`min-h-[5.5rem] p-2 border-b border-r border-white/[0.05] flex flex-col gap-1 transition-colors hover:bg-white/[0.04] ${
                    d.inMonth ? "" : "opacity-40"
                  } ${booked ? "bg-violet-500/[0.07]" : ""}`}
                >
                  <span
                    className={`text-sm tabular-nums ${
                      d.isToday
                        ? "text-violet-300 font-bold"
                        : "text-white/60"
                    }`}
                  >
                    {d.date.getDate()}
                  </span>
                  {booked ? (
                    <span className="mt-auto text-[11px] text-violet-200 font-medium">
                      {items.length} захиалга
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
