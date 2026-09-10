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
import { canEdit, canView, hasPermission, workingBranchScopeId } from "@/lib/auth/roles";
import { customerLabel } from "@/lib/customers";
import { prisma } from "@/lib/prisma";
import {
  loadBranchSchedule,
  loadBranchAttentionOrders,
  loadBranchAttentionAppointments,
} from "@/lib/branch-schedule-loader";
import { branchHoursForDate } from "@/lib/branches";
import { branchScheduleDisplaySelect } from "@/lib/branch-effective-schedule-server";
import { bookingSlotTime } from "@/lib/booking-time";
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABEL, ORDER_STATUS_TRANSITIONS } from "@/lib/orders";
import {
  AppointmentArrivedButton,
  AppointmentConfirmReject,
  AppointmentNoShowButton,
} from "@/app/dashboard/appointments/appointment-row-actions";
import { StatusControls } from "@/app/dashboard/orders/[id]/status-controls";
import {
  APPOINTMENT_BOOKING_PAYMENT_BADGE,
  APPOINTMENT_BOOKING_PAYMENT_LABEL,
  appointmentBookingPaymentStatus,
} from "@/lib/appointment-payment-status";
import { RowExpand } from "./row-expand";
import {
  appointmentDisplayName,
  orderDisplayName,
  repairCandidateDisplayName,
  buildDayRows,
  countHiddenUncertainCarryOverOrders,
  SCHEDULE_ISSUE_LABEL,
} from "./day-rows";
import {
  AppointmentOrderLinkRepair,
  type AppointmentOrderRepairCandidateView,
} from "./appointment-order-link-repair";
import { GridSchedule } from "./grid-schedule";
import { OrderDetailPanel } from "./order-detail-panel";
import { CalendarDateJump } from "./calendar-date-jump";

// Салбарын ажиллах цаг тодорхойгүй (branch.openTime/closeTime хоосон, эсвэл
// тухайн гараг хаалттай) үед grid-ийн цагийн тэнхлэгийг ямар ч утгагүй
// орхихгүйн тулд ажил хэргийн ердийн цонх (08:00–20:00) руу буцна.
const DEFAULT_GRID_OPEN_MINUTES = 8 * 60;
const DEFAULT_GRID_CLOSE_MINUTES = 20 * 60;

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
    layout?: string;
  }>;
}) {
  const user = await requireUser();
  if (!canView(user, "appointments")) redirect("/dashboard");
  const canRespondAppointments = canEdit(user, "appointments");
  const canEditOrders = canEdit(user, "orders");
  const canChangeItemStatus = hasPermission(user, "orders.itemStatus");

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
  const isDay = cal.interval === "day" && !isAttention;
  const isGrid = isDay && sp.layout !== "list";

  const daySchedule =
    isDay && dayBranchId
      ? await loadBranchSchedule({
          tenantId: user.tenantId,
          branchId: dayBranchId,
          dateStr: cal.days[0].key,
        })
      : null;

  // Grid харагдацын цагийн тэнхлэгийг салбарын тухайн өдрийн ажиллах цагаар
  // хязгаарлана — тодорхойгүй бол ердийн ажлын цонх руу буцна (доор).
  const dayBranchHours =
    isGrid && dayBranchId
      ? await prisma.branch.findFirst({
          where: { id: dayBranchId, tenantId: user.tenantId },
          select: {
            ...branchScheduleDisplaySelect(),
          },
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
  const attentionAppointments = dayBranchId
    ? await loadBranchAttentionAppointments({
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
  // нөгөөг цэвэрлэнэ. `layout` (Жагсаалт/Grid) зөвхөн Өдөр харагдацад хамаатай
  // тул interval/view солиход автоматаар хасагдана — доор тусад нь удирдана.
  const hrefWith = (over: {
    interval?: string;
    anchor?: string;
    view?: string;
    layout?: string;
  }) => {
    const p = new URLSearchParams();
    if (sp.branchId) p.set("branchId", sp.branchId);
    if (over.view) {
      p.set("view", over.view);
    } else {
      p.set("interval", over.interval ?? cal.interval);
      const layout = over.layout ?? (over.anchor !== undefined ? sp.layout : undefined);
      if (layout) p.set("layout", layout);
    }
    const anchor = over.anchor ?? sp.anchor;
    if (anchor) p.set("anchor", anchor);
    return `/dashboard/appointments/calendar?${p.toString()}`;
  };

  const navBtn =
    "px-3 py-1.5 rounded-lg border border-[var(--oc-line)] bg-[var(--oc-panel2)] hover:border-[var(--oc-line2)] hover:bg-white/[0.05] text-sm text-[var(--oc-ink2)] transition-colors";

  // Энэ хуудасны яг одоогийн URL (interval/anchor/branchId/layout хэвээр) —
  // энэ хуудаснаас захиалга/цаг захиалга үүсгэхэд `next`-ээр дамжуулж, ажил
  // дуусаад яг энэ хуудас руу (жагсаж байсан өдөр/харагдацаараа) буцаана.
  const returnTo = hrefWith({});

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
                Өнөөдөр рүү буцах
              </Link>
              <Link href={hrefWith({ anchor: cal.nextAnchorKey })} className={navBtn}>
                ›
              </Link>
            </div>

            <CalendarDateJump
              anchorKey={sp.anchor ?? cal.todayKey}
              interval={cal.interval}
              branchId={sp.branchId}
              layout={sp.layout}
            />
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

        {isDay ? (
          <div className="flex rounded-lg border border-[var(--oc-line)] overflow-hidden">
            <Link
              href={hrefWith({ layout: "list" })}
              className={`px-3 py-1.5 text-sm transition-colors ${
                !isGrid
                  ? "bg-[var(--oc-accent)] text-[var(--oc-on-accent)] font-medium"
                  : "text-[var(--oc-muted2)] hover:bg-white/[0.05]"
              }`}
            >
              Жагсаалт
            </Link>
            <Link
              href={hrefWith({ layout: "grid" })}
              className={`px-3 py-1.5 text-sm transition-colors border-l border-[var(--oc-line)] ${
                isGrid
                  ? "bg-[var(--oc-accent)] text-[var(--oc-on-accent)] font-medium"
                  : "text-[var(--oc-muted2)] hover:bg-white/[0.05]"
              }`}
            >
              Хүснэгт
            </Link>
          </div>
        ) : null}

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
          expiredAppointments={attentionAppointments}
          branchName={branches.find((b) => b.id === dayBranchId)?.name ?? null}
        />
      ) : cal.interval === "day" && isGrid ? (
        <DayScheduleGrid
          schedule={daySchedule}
          branchHours={dayBranchHours}
          dateKey={cal.days[0].key}
          branchId={dayBranchId}
          branchName={branches.find((b) => b.id === dayBranchId)?.name ?? null}
          canRespondAppointments={canRespondAppointments}
          canEditOrders={canEditOrders}
          canChangeItemStatus={canChangeItemStatus}
          returnTo={returnTo}
        />
      ) : cal.interval === "day" ? (
        <DaySchedule
          schedule={daySchedule}
          branchName={branches.find((b) => b.id === dayBranchId)?.name ?? null}
          attentionHref={hrefWith({ view: "attention" })}
          canRespondAppointments={canRespondAppointments}
          canEditOrders={canEditOrders}
          canChangeItemStatus={canChangeItemStatus}
          returnTo={returnTo}
        />
      ) : cal.interval === "week" ? (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
          {cal.days.map((d) => {
            const items = byDay.get(d.key) ?? [];
            const booked = items.length > 0;
            return (
              <Link
                key={d.key}
                href={hrefWith({ interval: "day", anchor: d.key })}
                className={`rounded-[10px] bg-[var(--oc-panel)] border min-h-[8rem] p-2.5 flex flex-col gap-1.5 transition-colors hover:border-[var(--oc-line2)] hover:bg-white/[0.02] ${
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
              </Link>
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
                  href={hrefWith({ interval: "day", anchor: d.key })}
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

// Захиалга/цаг захиалгын хуваарийг цагийн дараалалд харуулна — зөвхөн унших,
// эхлүүлэх/тэмдэглэх зэрэг үйлдэл энд байхгүй (дараагийн үе шат).
function DaySchedule({
  schedule,
  branchName,
  attentionHref,
  canRespondAppointments,
  canEditOrders,
  canChangeItemStatus,
  returnTo,
}: {
  schedule: DayScheduleData | null;
  branchName: string | null;
  attentionHref: string;
  canRespondAppointments: boolean;
  canEditOrders: boolean;
  canChangeItemStatus: boolean;
  returnTo: string;
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
  // Мэдэгдэж буй cross-midnight ажил дараагийн өдөрт continuation мөрөөр
  // харагдана. Харин төгсгөлгүй/аль хэдийн дууссан хуучин carried-over ажил
  // зөвхөн attention харагдацад үлдэнэ.
  const isHiddenCarryOverOrder = (id: string) => {
    const order = orderById.get(id);
    return order?.carriedOver === true && order.continuesIntoDay !== true;
  };
  const rows = schedule.intervals
    .filter((row) => row.source !== "order" || !isHiddenCarryOverOrder(row.id))
    .sort((a, b) => a.startMs - b.startMs);
  const issues = schedule.issues.filter(
    (issue) => issue.source !== "order" || !isHiddenCarryOverOrder(issue.id),
  );
  const issueBySourceId = new Map(
    issues.map((issue) => [`${issue.source}:${issue.id}`, issue]),
  );
  const carriedOverCount = countHiddenUncertainCarryOverOrders(schedule);

  return (
    <div className="flex flex-col gap-3">
      {branchName ? (
        <div className="text-sm text-[var(--oc-muted3)]">
          Салбар: <span className="text-[var(--oc-ink2)] font-medium">{branchName}</span>
        </div>
      ) : null}

      {carriedOverCount > 0 ? (
        <div className="rounded-[10px] border border-[var(--oc-warn)]/25 bg-[var(--oc-warn)]/[0.06] p-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-sm text-[var(--oc-warn)]">
            {carriedOverCount} идэвхтэй ажил тодорхойгүй хугацаатай тул энэ өдөртэй
            давхцах магадлалтай.
          </span>
          <Link
            href={attentionHref}
            className="text-sm text-[var(--oc-warn)] hover:opacity-80 transition-opacity"
          >
            Хоцорсон ажлуудыг шалгах →
          </Link>
        </div>
      ) : null}

      {issues.length > 0 ? (
        <div className="rounded-[10px] border border-[var(--oc-warn)]/25 bg-[var(--oc-warn)]/[0.06] p-3 flex flex-wrap gap-1.5">
          {issues.map((issue, i) => (
            <span
              key={`${issue.source}-${issue.id}-${i}`}
              className="font-plex-mono text-[10.5px] px-2 py-1 rounded-full bg-[var(--oc-warn)]/15 text-[var(--oc-warn)] border border-[var(--oc-warn)]/25"
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
              const bookingPaymentStatus = appt
                ? appointmentBookingPaymentStatus(appt)
                : null;
              const continuesFromPreviousDay =
                row.source === "order" && order?.continuesIntoDay === true;
              const endsAtDayBoundary = row.endMs === schedule.rangeEnd.getTime();
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
              const repairCandidates: AppointmentOrderRepairCandidateView[] =
                appt?.serviceOrderId && issue?.reason === "missing-order"
                  ? schedule.repairCandidates
                      .filter(
                        (candidate) =>
                          candidate.customerId === appt.customerId &&
                          candidate.vehicleId === appt.vehicleId,
                      )
                      .map((candidate) => ({
                        id: candidate.id,
                        number: candidate.number,
                        label: repairCandidateDisplayName(candidate),
                        statusLabel: ORDER_STATUS_LABEL[candidate.status],
                        statusClass: ORDER_STATUS_BADGE[candidate.status],
                      }))
                  : [];
              const showRepairAction =
                Boolean(appt?.serviceOrderId) &&
                issue?.reason === "missing-order" &&
                canRespondAppointments &&
                canEditOrders;
              const orderTransitions = order
                ? ORDER_STATUS_TRANSITIONS[order.status]
                : [];
              const showOrderControls =
                Boolean(order) && canEditOrders && orderTransitions.length > 0;
              const hasActions =
                showConfirmReject ||
                showArrivalActions ||
                showCreateOrderLink ||
                showOrderControls ||
                showRepairAction ||
                Boolean(order);
              const orderHref = appt
                ? `/dashboard/orders/new?${new URLSearchParams({
                    customerId: appt.customerId ?? "",
                    vehicleId: appt.vehicleId ?? "",
                    branchId: appt.branchId,
                    scheduledAt: new Date(row.startMs).toISOString(),
                    note: appt.note ?? "",
                    appointmentId: appt.id,
                    next: returnTo,
                  }).toString()}`
                : "";
              return (
                <div
                  key={`${row.source}-${row.id}`}
                  className="px-3 py-2.5 flex flex-wrap items-center gap-3"
                >
                  <span className="font-plex-mono text-xs font-semibold text-[var(--oc-ink2)] tabular-nums w-32 shrink-0">
                    {continuesFromPreviousDay ? "Өмнөх өдөр → " : null}
                    {row.uncertain
                      ? `${fmtUbTime(new Date(row.startMs))} → тодорхойгүй`
                      : `${fmtUbTime(new Date(row.startMs))}–${endsAtDayBoundary ? "24:00" : fmtUbTime(new Date(row.endMs))}`}
                  </span>
                  <span className="font-plex-mono text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--oc-panel2)] border border-[var(--oc-line)] text-[var(--oc-muted3)] shrink-0">
                    {row.source === "appointment" ? "Цаг захиалга" : "Захиалга"}
                  </span>
                  {statusBadge}
                  {bookingPaymentStatus && bookingPaymentStatus !== "NOT_REQUIRED" ? (
                    <span
                      className={`font-plex-mono text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ${APPOINTMENT_BOOKING_PAYMENT_BADGE[bookingPaymentStatus]}`}
                    >
                      {APPOINTMENT_BOOKING_PAYMENT_LABEL[bookingPaymentStatus]}
                    </span>
                  ) : null}
                  <span className="text-sm text-[var(--oc-ink2)] truncate flex-1">
                    {name}
                  </span>
                  {row.uncertain ? (
                    <span className="font-plex-mono text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--oc-warn)]/15 text-[var(--oc-warn)] border border-[var(--oc-warn)]/25 shrink-0">
                      Тодорхойгүй
                    </span>
                  ) : null}
                  {continuesFromPreviousDay ? (
                    <span className="font-plex-mono text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20 shrink-0">
                      Өмнөх өдрөөс үргэлжилсэн
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
                        <AppointmentConfirmReject
                          appointmentId={appt.id}
                          canConfirm={
                            bookingPaymentStatus === "NOT_REQUIRED" ||
                            bookingPaymentStatus === "PAID"
                          }
                        />
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
                      {showRepairAction && appt ? (
                        <AppointmentOrderLinkRepair
                          appointmentId={appt.id}
                          candidates={repairCandidates}
                        />
                      ) : null}
                      {showOrderControls && order ? (
                        <div className="w-64">
                          <StatusControls
                            orderId={order.id}
                            transitions={orderTransitions}
                            disabled={false}
                            currentStatus={order.status}
                            occupiesCapacity={order.occupiesCapacity}
                            expectedFinishAt={order.expectedFinishAt}
                            estimatedDurationMinutes={order.estimatedDurationMinutes}
                            attentionHref={`/dashboard/appointments/calendar?view=attention&branchId=${encodeURIComponent(order.branchId)}`}
                          />
                        </div>
                      ) : null}
                      {order ? (
                        <OrderDetailPanel
                          key={order.id}
                          orderId={order.id}
                          canChangeItemStatus={canChangeItemStatus}
                        />
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

// Жагсаалттай яг ижил өгөгдлөөс (buildDayRows) визуал grid харагдацыг угсарна —
// цагийн тэнхлэгийг салбарын ажиллах цагаар (эсвэл дутуу бол 08:00–20:00
// анхны утгаар) хязгаарлана.
function DayScheduleGrid({
  schedule,
  branchHours,
  dateKey: dayKey,
  branchId,
  branchName,
  canRespondAppointments,
  canEditOrders,
  canChangeItemStatus,
  returnTo,
}: {
  schedule: DayScheduleData | null;
  branchHours: {
    openTime: string | null;
    closeTime: string | null;
    schedules: Array<{
      weekday: "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";
      isOpen: boolean;
      openTime: string | null;
      closeTime: string | null;
    }>;
    scheduleExceptions?: Array<{
      date: Date;
      isOpen: boolean;
      openTime: string | null;
      closeTime: string | null;
      label: string | null;
    }>;
    scheduleSeasons?: Array<{
      name: string;
      startsOn: Date;
      endsOn: Date;
      isActive: boolean;
      days: Array<{
        weekday: "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";
        isOpen: boolean;
        openTime: string | null;
        closeTime: string | null;
      }>;
    }>;
  } | null;
  dateKey: string;
  branchId: string;
  branchName: string | null;
  canRespondAppointments: boolean;
  canEditOrders: boolean;
  canChangeItemStatus: boolean;
  returnTo: string;
}) {
  if (!schedule) {
    return (
      <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-6 text-sm text-[var(--oc-muted3)]">
        Өдрийн хуваарийг харахын тулд эхлээд салбар сонгоно уу.
      </div>
    );
  }

  const { rows, carriedOverCount } = buildDayRows(
    schedule,
    canRespondAppointments,
    canEditOrders,
    returnTo,
  );

  const hours = branchHours
    ? branchHoursForDate(branchHours, new Date(`${dayKey}T00:00:00+08:00`))
    : null;
  const openMinutes = hours?.openMinutes ?? DEFAULT_GRID_OPEN_MINUTES;
  const closeMinutes = hours?.closeMinutes ?? DEFAULT_GRID_CLOSE_MINUTES;
  // Захиалга нээлттэй цагийн гадна (жишээ нь эрт эхэлсэн) ч бүрэн харагдах ёстой
  // тул тэнхлэгийг мөрүүдийн бодит цаг хамарч байгаа эсэхээр өргөтгөнө.
  let axisStartMs = bookingSlotTime(dayKey, openMinutes).getTime();
  let axisEndMs = bookingSlotTime(dayKey, closeMinutes).getTime();
  for (const row of rows) {
    if (row.startMs < axisStartMs) axisStartMs = row.startMs;
    if (!row.uncertain && row.endMs > axisEndMs) axisEndMs = row.endMs;
  }

  return (
    <div className="flex flex-col gap-3">
      {branchName ? (
        <div className="text-sm text-[var(--oc-muted3)]">
          Салбар: <span className="text-[var(--oc-ink2)] font-medium">{branchName}</span>
        </div>
      ) : null}
      {carriedOverCount > 0 ? (
        <div className="rounded-[10px] border border-[var(--oc-warn)]/25 bg-[var(--oc-warn)]/[0.06] p-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-sm text-[var(--oc-warn)]">
            {carriedOverCount} идэвхтэй ажил тодорхойгүй хугацаатай тул энэ өдөртэй
            давхцах магадлалтай.
          </span>
          <Link
            href={`/dashboard/appointments/calendar?view=attention&branchId=${encodeURIComponent(branchId)}`}
            className="text-sm text-[var(--oc-warn)] hover:opacity-80 transition-opacity"
          >
            Хоцорсон ажлуудыг шалгах →
          </Link>
        </div>
      ) : null}
      <GridSchedule
        rows={rows}
        axisStartMs={axisStartMs}
        axisEndMs={axisEndMs}
        canChangeItemStatus={canChangeItemStatus}
        branchId={branchId}
        returnTo={returnTo}
      />
    </div>
  );
}

type AttentionData = Awaited<ReturnType<typeof loadBranchAttentionOrders>>;
type AttentionAppointmentsData = Awaited<ReturnType<typeof loadBranchAttentionAppointments>>;

// Огноогоос үл хамааран одоо тодорхойгүй/хэтэрсэн эзэмшилтэй бүх захиалга —
// өдрийн жагсаалтад давтагдан харагдахгүй, энд нэг л удаа, тогтмол харагдана.
function AttentionView({
  data,
  expiredAppointments,
  branchName,
}: {
  data: AttentionData | null;
  expiredAppointments: AttentionAppointmentsData | null;
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

      {expiredAppointments && expiredAppointments.appointments.length > 0 ? (
        <details className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)]/60 overflow-hidden group">
          <summary className="cursor-pointer select-none px-3 py-2 text-xs text-[var(--oc-muted4)] hover:text-[var(--oc-muted3)] transition-colors list-none flex items-center gap-1.5">
            <span className="inline-block transition-transform group-open:rotate-90">›</span>
            Хугацаа дууссан төлбөрийн захиалга ({expiredAppointments.appointments.length})
          </summary>
          <div className="divide-y divide-[var(--oc-line)] border-t border-[var(--oc-line)]">
            {expiredAppointments.appointments.map((a) => (
              <div
                key={a.id}
                className="px-3 py-2 flex items-center gap-3 text-xs text-[var(--oc-muted4)]"
              >
                <span className="truncate flex-1">{appointmentDisplayName(a)}</span>
                <Link
                  href={`/dashboard/appointments?status=PENDING&branchId=${encodeURIComponent(a.branchId)}`}
                  className="shrink-0 hover:text-[var(--oc-muted3)] underline underline-offset-2 transition-colors"
                >
                  Цаг захиалгын жагсаалт руу →
                </Link>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
