import Link from "next/link";
import { redirect } from "next/navigation";
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
import { canEdit, canView, workingBranchScopeId } from "@/lib/auth/roles";
import { customerLabel } from "@/lib/customers";
import { prisma } from "@/lib/prisma";
import {
  loadBranchSchedule,
  loadBranchAttentionOrders,
  type BranchScheduleAppointmentRow,
  type BranchScheduleOrderRow,
} from "@/lib/branch-schedule-loader";
import type { ScheduleIssue } from "@/lib/branch-schedule";
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABEL, ORDER_STATUS_TRANSITIONS } from "@/lib/orders";
import {
  AppointmentArrivedButton,
  AppointmentConfirmReject,
  AppointmentNoShowButton,
} from "@/app/dashboard/appointments/appointment-row-actions";
import { StatusControls } from "@/app/dashboard/orders/[id]/status-controls";
import { RowExpand } from "./row-expand";

const SCHEDULE_ISSUE_LABEL: Record<ScheduleIssue["reason"], string> = {
  "missing-estimate": "Тооцоолсон хугацаа дутуу",
  "unknown-occupancy": "Ажлын байрны эзэмшил тодорхойгүй",
  overdue: "Тооцоолсон хугацаанаас хэтэрсэн",
  "missing-order": "Холбогдсон захиалга олдсонгүй",
  "missing-start": "Эхэлсэн цаг тэмдэглэгдээгүй",
};

// Асиа/Улаанбаатар цагийн бүсээр — сервер өөр бүсэд байршиж болзошгүй тул.
function fmtUbTime(d: Date): string {
  return new Intl.DateTimeFormat("mn-MN", {
    timeZone: "Asia/Ulaanbaatar",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

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
    view?: string;
  }>;
}) {
  const user = await requireUser();
  if (!canView(user, "appointments")) redirect("/dashboard");
  const canRespondAppointments = canEdit(user, "appointments");
  const canEditOrders = canEdit(user, "orders");

  const sp = await searchParams;
  const cal = resolveCalendar(sp);
  const scopeBranchId = workingBranchScopeId(user);
  const branchId = scopeBranchId ?? (sp.branchId || "");

  const branches = await prisma.branch.findMany({
    where: {
      tenantId: user.tenantId,
      isActive: true,
      ...(scopeBranchId ? { id: scopeBranchId } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Өдрийн хуваарь салбар тус бүрээр тооцоологддог тул сонголт заавал хэрэгтэй —
  // тодорхой сонгоогүй бол эхний идэвхтэй салбарыг анхны утга болгоно.
  const dayBranchId = branchId || branches[0]?.id || "";

  const appointments =
    cal.interval === "day"
      ? []
      : await prisma.appointment.findMany({
          where: {
            tenantId: user.tenantId,
            status: { notIn: ["CANCELLED", "REJECTED"] },
            requestedAt: { gte: cal.rangeStart, lt: cal.rangeEnd },
            ...(branchId ? { branchId } : {}),
          },
          orderBy: { requestedAt: "asc" },
          include: {
            account: { select: { name: true, phone: true } },
            customer: { select: { fullName: true, phone: true } },
            branch: { select: { name: true } },
          },
        });

  const isAttention = sp.view === "attention";

  const daySchedule =
    cal.interval === "day" && !isAttention && dayBranchId
      ? await loadBranchSchedule({
          tenantId: user.tenantId,
          branchId: dayBranchId,
          dateStr: cal.days[0].key,
        })
      : null;

  // Идэвхтэй харагдац эсэхээс үл хамааран товчлуурын дэргэдэх тоог үзүүлэхийн
  // тулд байнга (салбар сонгогдсон бол) ачаална.
  const attentionData = dayBranchId
    ? await loadBranchAttentionOrders({
        tenantId: user.tenantId,
        branchId: dayBranchId,
      })
    : null;

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

  // Навигаци / toggle линкийн query-г бүрдүүлэгч. `view` (Хоцорсон ажлууд) болон
  // `interval` (Өдөр/7 хоног/Сар) харилцан адилгүй — аль нэгийг сонговол
  // нөгөөг цэвэрлэнэ.
  const hrefWith = (over: { interval?: string; anchor?: string; view?: string }) => {
    const p = new URLSearchParams();
    if (sp.branchId) p.set("branchId", sp.branchId);
    if (over.view) {
      p.set("view", over.view);
    } else {
      p.set("interval", over.interval ?? cal.interval);
    }
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
        {/* Өдөр / 7 хоног / Сар toggle */}
        <div className="flex rounded-lg border border-[var(--oc-line)] overflow-hidden">
          <Link
            href={hrefWith({ interval: "day" })}
            className={`px-3 py-1.5 text-sm transition-colors ${
              cal.interval === "day" && !isAttention
                ? "bg-[var(--oc-accent)] text-[var(--oc-on-accent)] font-medium"
                : "text-[var(--oc-muted2)] hover:bg-white/[0.05]"
            }`}
          >
            Өдөр
          </Link>
          <Link
            href={hrefWith({ interval: "week" })}
            className={`px-3 py-1.5 text-sm transition-colors border-l border-[var(--oc-line)] ${
              cal.interval === "week" && !isAttention
                ? "bg-[var(--oc-accent)] text-[var(--oc-on-accent)] font-medium"
                : "text-[var(--oc-muted2)] hover:bg-white/[0.05]"
            }`}
          >
            7 хоног
          </Link>
          <Link
            href={hrefWith({ interval: "month" })}
            className={`px-3 py-1.5 text-sm transition-colors border-l border-[var(--oc-line)] ${
              cal.interval === "month" && !isAttention
                ? "bg-[var(--oc-accent)] text-[var(--oc-on-accent)] font-medium"
                : "text-[var(--oc-muted2)] hover:bg-white/[0.05]"
            }`}
          >
            Сар
          </Link>
        </div>

        {!isAttention ? (
          <>
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
          </>
        ) : null}

        <Link
          href={hrefWith({ view: "attention" })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
            isAttention
              ? "border-red-500/50 bg-red-500/20 text-red-400 font-medium"
              : "border-red-500/25 bg-red-500/10 text-red-400 hover:border-red-500/40 hover:bg-red-500/15"
          }`}
        >
          Хоцорсон ажлууд
          {attentionData && attentionData.orders.length > 0 ? (
            <span className="font-plex-mono text-[11px] px-1.5 py-0.5 rounded-full bg-red-500/25 text-red-300">
              {attentionData.orders.length}
            </span>
          ) : null}
        </Link>

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

      {isAttention ? (
        <AttentionView
          data={attentionData}
          branchName={branches.find((b) => b.id === dayBranchId)?.name ?? null}
        />
      ) : cal.interval === "day" ? (
        <DaySchedule
          schedule={daySchedule}
          branchName={branches.find((b) => b.id === dayBranchId)?.name ?? null}
          attentionHref={hrefWith({ view: "attention" })}
          canRespondAppointments={canRespondAppointments}
          canEditOrders={canEditOrders}
        />
      ) : cal.interval === "week" ? (
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

type DayScheduleData = Awaited<ReturnType<typeof loadBranchSchedule>>;

function appointmentDisplayName(a: BranchScheduleAppointmentRow): string {
  return customerLabel({
    fullName: a.account?.name ?? a.customer?.fullName,
    phone: a.account?.phone ?? a.customer?.phone,
  });
}

function orderDisplayName(o: BranchScheduleOrderRow): string {
  const vehicle = o.vehicle
    ? `${o.vehicle.plate} · ${o.vehicle.make} ${o.vehicle.model}`
    : null;
  const customer = customerLabel({
    fullName: o.customer?.fullName,
    phone: o.customer?.phone,
  });
  return vehicle ? `${customer} — ${vehicle}` : customer;
}

// Захиалга/цаг захиалгын хуваарийг цагийн дараалалд харуулна — зөвхөн унших,
// эхлүүлэх/тэмдэглэх зэрэг үйлдэл энд байхгүй (дараагийн үе шат).
function DaySchedule({
  schedule,
  branchName,
  attentionHref,
  canRespondAppointments,
  canEditOrders,
}: {
  schedule: DayScheduleData | null;
  branchName: string | null;
  attentionHref: string;
  canRespondAppointments: boolean;
  canEditOrders: boolean;
}) {
  if (!schedule) {
    return (
      <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-6 text-sm text-[var(--oc-muted3)]">
        Өдрийн хуваарийг харахын тулд эхлээд салбар сонгоно уу.
      </div>
    );
  }

  const appointmentById = new Map(schedule.appointments.map((a) => [a.id, a]));
  const orderById = new Map(schedule.orders.map((o) => [o.id, o]));
  // Өөр өдрөөс тасралтгүй үргэлжилж буй ("carried over") захиалгыг өдрийн
  // жагсаалтад харуулахгүй — тэдгээр нь өдөр бүрт ижилхэн давтагдан харагдаж
  // байсан (жинхэнэ огноогүй тул). "Хоцорсон ажлууд" харагдацад л харуулна
  // (loadBranchAttentionOrders).
  const isCarriedOverOrder = (id: string) => orderById.get(id)?.carriedOver === true;
  const rows = schedule.intervals
    .filter((row) => row.source !== "order" || !isCarriedOverOrder(row.id))
    .sort((a, b) => a.startMs - b.startMs);
  const issues = schedule.issues.filter(
    (issue) => issue.source !== "order" || !isCarriedOverOrder(issue.id),
  );
  const issueBySourceId = new Map(
    issues.map((issue) => [`${issue.source}:${issue.id}`, issue]),
  );
  const carriedOverCount = schedule.orders.filter((o) => o.carriedOver).length;

  return (
    <div className="flex flex-col gap-3">
      {branchName ? (
        <div className="text-sm text-[var(--oc-muted3)]">
          Салбар: <span className="text-[var(--oc-ink2)] font-medium">{branchName}</span>
        </div>
      ) : null}

      {carriedOverCount > 0 ? (
        <Link
          href={attentionHref}
          className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
        >
          {carriedOverCount} хоцорсон ажил байна →
        </Link>
      ) : null}

      {issues.length > 0 ? (
        <div className="rounded-[10px] border border-amber-500/25 bg-amber-500/[0.06] p-3 flex flex-wrap gap-1.5">
          {issues.map((issue, i) => (
            <span
              key={`${issue.source}-${issue.id}-${i}`}
              className="font-plex-mono text-[10.5px] px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25"
            >
              {SCHEDULE_ISSUE_LABEL[issue.reason]}
            </span>
          ))}
        </div>
      ) : null}

      <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-[var(--oc-muted4)]">
            Энэ өдөр хуваарь хоосон байна.
          </div>
        ) : (
          <div className="divide-y divide-[var(--oc-line)]">
            {rows.map((row) => {
              const issue = issueBySourceId.get(`${row.source}:${row.id}`);
              const appt =
                row.source === "appointment" ? appointmentById.get(row.id) : null;
              const order = row.source === "order" ? orderById.get(row.id) : null;
              const name = appt
                ? appointmentDisplayName(appt)
                : order
                  ? orderDisplayName(order)
                  : "—";
              const statusBadge = appt ? (
                <span
                  className={`font-plex-mono text-[10px] px-1.5 py-0.5 rounded-full ${APPOINTMENT_STATUS_BADGE[appt.status]}`}
                >
                  {APPOINTMENT_STATUS_LABEL[appt.status]}
                </span>
              ) : order ? (
                <span
                  className={`font-plex-mono text-[10px] px-1.5 py-0.5 rounded-full ${ORDER_STATUS_BADGE[order.status]}`}
                >
                  {ORDER_STATUS_LABEL[order.status]}
                </span>
              ) : null;
              const showConfirmReject =
                appt?.status === "PENDING" && canRespondAppointments;
              const showArrivalActions =
                appt?.status === "CONFIRMED" &&
                canRespondAppointments &&
                !appt.arrivedAt;
              const showCreateOrderLink =
                appt?.status === "CONFIRMED" &&
                canRespondAppointments &&
                !appt.serviceOrderId;
              const orderTransitions = order
                ? ORDER_STATUS_TRANSITIONS[order.status]
                : [];
              const showOrderControls =
                Boolean(order) && canEditOrders && orderTransitions.length > 0;
              const hasActions =
                showConfirmReject ||
                showArrivalActions ||
                showCreateOrderLink ||
                showOrderControls;
              const orderHref = appt
                ? `/dashboard/orders/new?${new URLSearchParams({
                    customerId: appt.customerId ?? "",
                    vehicleId: appt.vehicleId ?? "",
                    branchId: appt.branchId,
                    scheduledAt: new Date(row.startMs).toISOString(),
                    note: appt.note ?? "",
                    appointmentId: appt.id,
                  }).toString()}`
                : "";
              return (
                <div
                  key={`${row.source}-${row.id}`}
                  className="px-3 py-2.5 flex flex-wrap items-center gap-3"
                >
                  <span className="font-plex-mono text-xs font-semibold text-[var(--oc-ink2)] tabular-nums w-32 shrink-0">
                    {row.uncertain
                      ? `${fmtUbTime(new Date(row.startMs))} → тодорхойгүй`
                      : `${fmtUbTime(new Date(row.startMs))}–${fmtUbTime(new Date(row.endMs))}`}
                  </span>
                  <span className="font-plex-mono text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--oc-panel2)] border border-[var(--oc-line)] text-[var(--oc-muted3)] shrink-0">
                    {row.source === "appointment" ? "Цаг захиалга" : "Захиалга"}
                  </span>
                  {statusBadge}
                  <span className="text-sm text-[var(--oc-ink2)] truncate flex-1">
                    {name}
                  </span>
                  {row.uncertain ? (
                    <span className="font-plex-mono text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 shrink-0">
                      Тодорхойгүй
                    </span>
                  ) : null}
                  {issue ? (
                    <span className="font-plex-mono text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
                      {SCHEDULE_ISSUE_LABEL[issue.reason]}
                    </span>
                  ) : null}
                  {hasActions ? (
                    <RowExpand>
                      {showConfirmReject && appt ? (
                        <AppointmentConfirmReject appointmentId={appt.id} />
                      ) : null}
                      {showArrivalActions && appt ? (
                        <>
                          <AppointmentArrivedButton appointmentId={appt.id} />
                          <AppointmentNoShowButton appointmentId={appt.id} />
                        </>
                      ) : null}
                      {showCreateOrderLink ? (
                        <Link
                          href={orderHref}
                          className="text-xs px-3 py-1.5 rounded-lg border border-[var(--oc-line)] bg-[var(--oc-panel2)] text-[var(--oc-ink2)] hover:border-[var(--oc-line2)] hover:bg-white/[0.05] transition-colors"
                        >
                          Засварын хуудас үүсгэх →
                        </Link>
                      ) : null}
                      {showOrderControls && order ? (
                        <div className="w-64">
                          <StatusControls
                            orderId={order.id}
                            transitions={orderTransitions}
                            disabled={false}
                            currentStatus={order.status}
                            occupiesCapacity={order.occupiesCapacity}
                          />
                        </div>
                      ) : null}
                    </RowExpand>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

type AttentionData = Awaited<ReturnType<typeof loadBranchAttentionOrders>>;

// Огноогоос үл хамааран одоо тодорхойгүй/хэтэрсэн эзэмшилтэй бүх захиалга —
// өдрийн жагсаалтад давтагдан харагдахгүй, энд нэг л удаа, тогтмол харагдана.
function AttentionView({
  data,
  branchName,
}: {
  data: AttentionData | null;
  branchName: string | null;
}) {
  if (!data) {
    return (
      <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-6 text-sm text-[var(--oc-muted3)]">
        Харахын тулд эхлээд салбар сонгоно уу.
      </div>
    );
  }

  const orderById = new Map(data.orders.map((o) => [o.id, o]));
  const issueBySourceId = new Map(
    data.issues.map((issue) => [`${issue.source}:${issue.id}`, issue]),
  );
  const rows = [...data.intervals].sort((a, b) => a.startMs - b.startMs);

  return (
    <div className="flex flex-col gap-3">
      {branchName ? (
        <div className="text-sm text-[var(--oc-muted3)]">
          Салбар: <span className="text-[var(--oc-ink2)] font-medium">{branchName}</span>
        </div>
      ) : null}
      <p className="text-sm text-[var(--oc-muted3)]">
        Тодорхой огноогүй, тооцоолол дутуу, эсвэл хугацаа хэтэрсэн ажлын
        байрны эзэмшил — өдрийн хуваарьт биш, энд тогтмол харагдана.
      </p>

      <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-[var(--oc-muted4)]">
            Хоцорсон ажил алга.
          </div>
        ) : (
          <div className="divide-y divide-[var(--oc-line)]">
            {rows.map((row) => {
              const issue = issueBySourceId.get(`${row.source}:${row.id}`);
              const order = orderById.get(row.id);
              if (!order) return null;
              return (
                <div
                  key={`${row.source}-${row.id}`}
                  className="px-3 py-2.5 flex items-center gap-3"
                >
                  <span
                    className={`font-plex-mono text-[10px] px-1.5 py-0.5 rounded-full ${ORDER_STATUS_BADGE[order.status]} shrink-0`}
                  >
                    {ORDER_STATUS_LABEL[order.status]}
                  </span>
                  <span className="text-sm text-[var(--oc-ink2)] truncate flex-1">
                    {orderDisplayName(order)}
                  </span>
                  {issue ? (
                    <span className="font-plex-mono text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
                      {SCHEDULE_ISSUE_LABEL[issue.reason]}
                    </span>
                  ) : null}
                  <Link
                    href={`/dashboard/orders/${order.id}`}
                    className="font-plex-mono text-[10px] px-2 py-1 rounded-full border border-[var(--oc-line)] bg-[var(--oc-panel2)] text-[var(--oc-muted3)] hover:border-[var(--oc-line2)] hover:bg-white/[0.05] transition-colors shrink-0"
                  >
                    Захиалга руу →
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
