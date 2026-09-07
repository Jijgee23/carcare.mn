import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { BtnLink } from "@/app/_components/landing-ops-ui";
import { FilterSelect } from "@/app/_components/list-filters";
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
import { canView, workingBranchScopeId } from "@/lib/auth/roles";
import { customerLabel } from "@/lib/customers";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Цаг захиалгын календарь",
};

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("mn-MN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
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
  const scopeBranchId = workingBranchScopeId(user);
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
        account: { select: { name: true, phone: true } },
        customer: { select: { fullName: true, phone: true } },
        branch: { select: { name: true } },
      },
    }),
    prisma.branch.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
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

  // Нэргүй бол placeholder биш — утсаар нь харуулна (customerLabel).
  const apptName = (a: Appt) =>
    customerLabel({
      fullName: a.account?.name ?? a.customer?.fullName,
      phone: a.account?.phone ?? a.customer?.phone,
    });

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
    "px-3 py-1.5 rounded-lg border border-[var(--oc-line)] bg-[var(--oc-panel2)] hover:border-[var(--oc-line2)] hover:bg-white/[0.05] text-sm text-[var(--oc-ink2)] transition-colors";

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <nav className="flex items-center gap-1.5 text-[13px] text-[var(--oc-muted3)] mb-3">
        <Link href="/dashboard/appointments" className="hover:text-[var(--oc-accent-hi)] transition-colors">
          Цаг захиалга
        </Link>
        <span>/</span>
        <span className="text-[var(--oc-muted)]">Календарь</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--oc-ink)]">Цаг захиалгын календарь</h1>
          <p className="text-sm text-[var(--oc-muted3)] mt-1">
            Аль салбарт, хэзээ цаг захиалагдсан, аль нь сул болохыг харна.
          </p>
        </div>
        <BtnLink href="/dashboard/appointments" variant="ghost">
          Жагсаалт
        </BtnLink>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* 7 хоног / Сар toggle */}
        <div className="flex rounded-lg border border-[var(--oc-line)] overflow-hidden">
          <Link
            href={hrefWith({ interval: "week" })}
            className={`px-3 py-1.5 text-sm transition-colors ${
              cal.interval === "week"
                ? "bg-[var(--oc-accent)] text-[var(--oc-on-accent)] font-medium"
                : "text-[var(--oc-muted2)] hover:bg-white/[0.05]"
            }`}
          >
            7 хоног
          </Link>
          <Link
            href={hrefWith({ interval: "month" })}
            className={`px-3 py-1.5 text-sm transition-colors border-l border-[var(--oc-line)] ${
              cal.interval === "month"
                ? "bg-[var(--oc-accent)] text-[var(--oc-on-accent)] font-medium"
                : "text-[var(--oc-muted2)] hover:bg-white/[0.05]"
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

        <span className="text-sm font-medium text-[var(--oc-ink2)] px-1">
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
                className={`rounded-[10px] bg-[var(--oc-panel)] border min-h-[8rem] p-2.5 flex flex-col gap-1.5 ${
                  d.isToday
                    ? "border-[var(--oc-accent)]/50"
                    : booked
                      ? "border-[var(--oc-line2)]"
                      : "border-[var(--oc-line)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-plex-mono text-xs text-[var(--oc-muted3)]">
                    {WEEKDAY_LABELS[(d.date.getDay() + 6) % 7]}
                  </span>
                  <span
                    className={`font-plex-mono text-sm font-semibold tabular-nums ${
                      d.isToday ? "text-[var(--oc-accent)]" : "text-[var(--oc-ink2)]"
                    }`}
                  >
                    {d.date.getDate()}
                  </span>
                </div>

                {booked ? (
                  items.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-lg bg-[var(--oc-panel2)] border border-[var(--oc-line)] px-2 py-1.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-plex-mono text-xs font-semibold text-[var(--oc-ink2)] tabular-nums">
                          {fmtTime(a.requestedAt)}
                        </span>
                        <span
                          className={`ml-auto font-plex-mono text-[10px] px-1.5 py-0.5 rounded-full ${APPOINTMENT_STATUS_BADGE[a.status]}`}
                        >
                          {APPOINTMENT_STATUS_LABEL[a.status]}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--oc-muted2)] truncate mt-0.5">
                        {apptName(a)}
                      </div>
                      {!branchId ? (
                        <div className="text-[10px] text-[var(--oc-muted4)] truncate">
                          {a.branch.name}
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="flex-1 flex items-center justify-center text-xs text-[var(--oc-muted4)]">
                    Сул
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[var(--oc-line)]">
            {WEEKDAY_LABELS.map((w) => (
              <div
                key={w}
                className="text-center font-plex-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--oc-muted3)] font-medium py-2"
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
                  className={`min-h-[5.5rem] p-2 border-b border-r border-[var(--oc-line)] flex flex-col gap-1 transition-colors hover:bg-white/[0.04] ${
                    d.inMonth ? "" : "opacity-40"
                  } ${booked ? "bg-[var(--oc-accent)]/[0.07]" : ""}`}
                >
                  <span
                    className={`font-plex-mono text-sm tabular-nums ${
                      d.isToday
                        ? "text-[var(--oc-accent)] font-bold"
                        : "text-[var(--oc-muted2)]"
                    }`}
                  >
                    {d.date.getDate()}
                  </span>
                  {booked ? (
                    <span className="mt-auto font-plex-mono text-[11px] text-[var(--oc-accent)] font-medium">
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
