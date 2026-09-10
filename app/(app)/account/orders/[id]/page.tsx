import Link from "next/link";
import { notFound } from "next/navigation";
import { BtnLink } from "@/app/_components/landing-ops-ui";
import { OrderStatusHistorySection } from "@/app/_components/order-status-history";
import { requireAccount } from "@/lib/auth/account";
import {
  ITEM_KIND_BADGE,
  ITEM_KIND_LABEL,
  ORDER_STATUS_BADGE,
  ORDER_STATUS_HISTORY_CUSTOMER_SELECT,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_BADGE,
  PAYMENT_STATUS_LABEL,
  SERVICE_ITEM_STATUS_BADGE,
  SERVICE_ITEM_STATUS_LABEL,
  formatTugrik,
  type ItemKind,
  type OrderStatus,
  type PaymentStatus,
  type ServiceItemStatus,
} from "@/lib/orders";
import { prisma } from "@/lib/prisma";

// Цаг захиалгагүй (walk-in) захиалгын дэлгэрэнгүй — ажилтан утсаар/шууд
// ирсэн машинд цаг захиалгагүйгээр шууд үүсгэсэн засварын хуудас.
// account/appointments/[id]/page.tsx-ийн "Ажлын явц" картын адил render,
// гагцхүү Appointment-специфик хэсгүүд (requestedAt/category/тэмдэглэл/
// цуцлах/хураамж) байхгүй — эдгээр нь энд утгагүй.
export const metadata = {
  title: "Захиалгын дэлгэрэнгүй",
};

export const dynamic = "force-dynamic";

// Хойшлогдсон захиалгад хуучин "дуусах хугацаа"-ны таамаг хамааралгүй болсон
// тул хэзээ ч "хожимдсон" гэж тооцохгүй — шинэ буцах цаг үүнийг орлоно (D-081).
function computeIsDelayed(order: {
  status: string;
  expectedFinishAt: Date | null;
}): boolean {
  return (
    order.status !== "COMPLETED" &&
    order.status !== "CANCELLED" &&
    order.status !== "POSTPONED" &&
    order.expectedFinishAt != null &&
    order.expectedFinishAt.getTime() < Date.now()
  );
}

function fmtEstimatedMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours && minutes) return `${hours} ц ${minutes} мин`;
  if (hours) return `${hours} ц`;
  return `${minutes} мин`;
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function qtyText(q: string): string {
  const n = Number.parseFloat(q);
  return Number.isFinite(n) ? n.toLocaleString("mn-MN", { maximumFractionDigits: 3 }) : q;
}

export default async function AccountWalkInOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const account = await requireAccount();
  const { id } = await params;

  const order = await prisma.serviceOrder.findFirst({
    where: { id, customer: { accountId: account.id } },
    select: {
      id: true,
      number: true,
      status: true,
      paymentStatus: true,
      scheduledAt: true,
      startedAt: true,
      completedAt: true,
      estimatedDurationMinutes: true,
      expectedFinishAt: true,
      totalAmount: true,
      paidAmount: true,
      tenant: { select: { name: true } },
      branch: { select: { name: true, phone: true } },
      vehicle: { select: { plate: true, make: true, model: true, year: true } },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          kind: true,
          description: true,
          status: true,
          quantity: true,
          unitPrice: true,
          total: true,
        },
      },
      statusChanges: {
        orderBy: { createdAt: "desc" },
        select: ORDER_STATUS_HISTORY_CUSTOMER_SELECT,
      },
      timeBookings: {
        where: { kind: "SCHEDULED", closedAt: null },
        select: { startAt: true },
        take: 1,
      },
    },
  });
  if (!order) notFound();

  const scheduledReturnAt = order.timeBookings[0]?.startAt ?? null;

  const isDelayed = computeIsDelayed(order);
  // Дууссан + бүрэн төлөгдсөн ажлыг Үйлчилгээний түүхэнд харуулна (харах:
  // app/account/history) — /api/v1/app/appointments-ийн ижил дүрэм.
  const settled = order.status === "COMPLETED" && order.paymentStatus === "PAID";

  return (
    <div className="w-full max-w-full flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">{order.tenant.name}</h1>
          <p className="text-[var(--oc-muted)] text-sm mt-0.5">
            {order.branch.name}
            {order.branch.phone ? ` · ${order.branch.phone}` : ""}
          </p>
          <p className="text-[var(--oc-muted2)] text-sm mt-0.5">
            {order.vehicle.plate} · {order.vehicle.make} {order.vehicle.model}
            {order.vehicle.year ? ` · ${order.vehicle.year}` : ""}
          </p>
        </div>
        <BtnLink href="/account" variant="ghost" className="shrink-0">
          ← Буцах
        </BtnLink>
      </div>

      <div>
        <h2 className="font-semibold text-[var(--oc-ink2)] text-sm mb-2">
          Ажлын явц
        </h2>
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`font-plex-mono text-[11px] px-2.5 py-1 rounded-full ${ORDER_STATUS_BADGE[order.status as OrderStatus]}`}
            >
              {ORDER_STATUS_LABEL[order.status as OrderStatus]}
            </span>
            <span
              className={`font-plex-mono text-[11px] px-2.5 py-1 rounded-full ${PAYMENT_STATUS_BADGE[order.paymentStatus as PaymentStatus]}`}
            >
              {PAYMENT_STATUS_LABEL[order.paymentStatus as PaymentStatus]}
            </span>
            <span className="text-xs text-[var(--oc-muted3)] font-plex-mono">
              №{order.number}
            </span>
          </div>
          {order.status === "SCHEDULED" && order.scheduledAt ? (
            <span className="text-xs text-[var(--oc-muted2)]">
              Товлосон огноо: {fmtDateTime(order.scheduledAt)}
            </span>
          ) : null}
          {order.status === "POSTPONED" && scheduledReturnAt ? (
            <span className="text-sm font-bold text-purple-400 light:text-purple-700">
              Засвар үргэлжлэх цаг: {fmtDateTime(scheduledReturnAt)}
            </span>
          ) : null}
          {order.estimatedDurationMinutes != null ||
          (order.status !== "POSTPONED" && order.expectedFinishAt != null) ? (
            <div className="flex flex-col gap-0.5">
              {order.estimatedDurationMinutes != null ? (
                <span className="text-xs text-[var(--oc-muted2)]">
                  Ойролцоо хугацаа: {fmtEstimatedMinutes(order.estimatedDurationMinutes)}
                </span>
              ) : null}
              {order.status !== "POSTPONED" && order.expectedFinishAt ? (
                <span
                  className={`text-xs ${isDelayed ? "text-red-400 font-medium" : "text-[var(--oc-muted2)]"}`}
                >
                  {isDelayed ? "Дуусах ёстой байсан" : "Дуусах хугацаа"}:{" "}
                  {fmtDateTime(order.expectedFinishAt)}
                </span>
              ) : null}
              {isDelayed ? (
                <span className="text-xs text-red-400 font-medium">
                  Төлөвлөснөөс хожимдож байна
                </span>
              ) : null}
            </div>
          ) : null}
          {order.items.length ? (
            <div className="flex flex-col divide-y divide-[var(--oc-line)]">
              {order.items.map((it) => (
                <div key={it.id} className="flex items-start gap-3 py-2.5">
                  <span
                    className={`shrink-0 mt-0.5 font-plex-mono text-[10px] px-1.5 py-0.5 rounded-full ${ITEM_KIND_BADGE[it.kind as ItemKind]}`}
                  >
                    {ITEM_KIND_LABEL[it.kind as ItemKind]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-[var(--oc-ink2)]">
                        {it.description}
                      </span>
                      <span
                        className={`shrink-0 font-plex-mono text-[10px] px-1.5 py-0.5 rounded-full ${SERVICE_ITEM_STATUS_BADGE[it.status as ServiceItemStatus]}`}
                      >
                        {SERVICE_ITEM_STATUS_LABEL[it.status as ServiceItemStatus]}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--oc-muted3)] mt-0.5 tabular-nums">
                      {qtyText(it.quantity.toString())} × {formatTugrik(it.unitPrice.toString())}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-medium text-[var(--oc-ink)] tabular-nums">
                    {formatTugrik(it.total.toString())}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {order.totalAmount != null ? (
            <div className="rounded-lg bg-[var(--oc-panel2)] border border-[var(--oc-line)] p-3 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--oc-muted)]">Нийт дүн</span>
                <span className="font-bold text-[var(--oc-ink)] tabular-nums">
                  {formatTugrik(order.totalAmount.toString())}
                </span>
              </div>
              {order.paidAmount != null ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--oc-muted)]">Төлсөн</span>
                  <span className="text-[var(--oc-ink2)] tabular-nums">
                    {formatTugrik(order.paidAmount.toString())}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
          {settled ? (
            <Link
              href={`/account/history/${order.id}`}
              className="text-sm text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] transition-colors w-fit"
            >
              Дэлгэрэнгүй түүхэнд харах →
            </Link>
          ) : null}
        </div>
      </div>

      <OrderStatusHistorySection entries={order.statusChanges} />
    </div>
  );
}
