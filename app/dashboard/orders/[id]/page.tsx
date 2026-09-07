import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteOrderAction } from "@/app/_actions/orders";
import { Btn, BtnLink } from "@/app/_components/landing-ops-ui";
import { requireUser } from "@/lib/auth";
import {
  ORDER_ASSIGNABLE_WHERE,
  canDelete,
  canEdit,
  canView,
  workingBranchScopeId,
} from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import {
  DIAGNOSTIC_TYPE_BADGE,
  DIAGNOSTIC_TYPE_LABEL,
  type DiagnosticType,
} from "@/lib/diagnostics";
import { customerLabel } from "@/lib/customers";
import type { ServiceKind } from "@/lib/services";
import {
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TRANSITIONS,
  PAYMENT_STATUS_BADGE,
  PAYMENT_STATUS_LABEL,
  POSTPAID_BADGE,
  POSTPAID_LABEL,
  type OrderStatus,
  type PaymentStatus,
  canFillDiagnostics,
  formatTugrik,
} from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import type { QPayBankUrl } from "@/lib/qpay-tenant";
import { AddItemForm } from "./add-item-form";
import { OrderItems } from "./order-items";
import { PaymentControls } from "./payment-controls";
import { QPayWidget } from "./qpay-widget";
import { StatusControls } from "./status-controls";
import { OrderForm } from "../order-form";

export const metadata = {
  title: "Захиалгын дэлгэрэнгүй",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!canView(user, "orders")) redirect("/dashboard");
  const canEditOrder = canEdit(user, "orders");
  const canDeleteOrder = canDelete(user, "orders");
  const canEditPayments = canEdit(user, "payments");
  const scopeBranchId = workingBranchScopeId(user);
  const { id } = await params;

  const [order, branches, customers, vehicles, technicians, services, reports, activeTemplateCount, diagnosticTemplates] = await Promise.all([
    prisma.serviceOrder.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        ...(scopeBranchId ? { branchId: scopeBranchId } : {}),
      },
      include: {
        items: { orderBy: { createdAt: "asc" } },
        customer: { select: { id: true, fullName: true, phone: true } },
        vehicle: {
          select: {
            id: true,
            plate: true,
            make: true,
            model: true,
            year: true,
          },
        },
        branch: { select: { name: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
        plannedDiagnostics: {
          orderBy: { createdAt: "asc" },
          include: { template: { select: { id: true, name: true, type: true } } },
        },
      },
    }),
    prisma.branch.findMany({
      where: {
        tenantId: user.tenantId,
        ...(scopeBranchId ? { id: scopeBranchId } : {}),
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    prisma.customer.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, phone: true },
    }),
    prisma.tenantVehicle
      .findMany({
        where: { tenantId: user.tenantId, isActive: true },
        orderBy: { createdAt: "desc" },
        select: {
          customerId: true,
          isPostpaid: true,
          vehicle: {
            select: { id: true, plate: true, make: true, model: true },
          },
        },
      })
      .then((rows) =>
        rows.map((r) => ({
          ...r.vehicle,
          customerId: r.customerId,
          isPostpaid: r.isPostpaid,
        })),
      ),
    prisma.user.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        ...ORDER_ASSIGNABLE_WHERE,
      },
      orderBy: { firstName: "asc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        branchId: true,
        assignableBranchIds: true,
        isOwner: true,
        role: { select: { name: true } },
      },
    }),
    prisma.service.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        OR: [{ type: "LABOR" }, { type: "GOODS", stock: { gt: 0 } }],
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: {
        id: true,
        type: true,
        name: true,
        code: true,
        price: true,
        stock: true,
        unit: { select: { name: true } },
        categoryId: true,
        category: { select: { name: true } },
      },
    }),
    prisma.diagnosticReport.findMany({
      where: { orderId: id, tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        template: { select: { name: true, type: true } },
        filledBy: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.diagnosticTemplate.count({
      where: { tenantId: user.tenantId, isActive: true },
    }),
    prisma.diagnosticTemplate.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        type: true,
        price: true,
        durationMin: true,
      },
    }),
  ]);

  // QPay тохиргоо + одоо хүлээгдэж байгаа QPay invoice
  const [qpayConfig, pendingOrderPayment] = await Promise.all([
    prisma.tenantQPaySettings.findUnique({
      where: { tenantId: user.tenantId },
      select: { enabled: true },
    }),
    prisma.orderPayment.findFirst({
      where: { orderId: id, status: "PENDING", method: "QPAY" },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const qpayReady = Boolean(qpayConfig?.enabled);

  if (!order) notFound();

  const status = order.status as OrderStatus;
  const paymentStatus = order.paymentStatus as PaymentStatus;
  const allowedTransitions = ORDER_STATUS_TRANSITIONS[status];
  const isEditable = status !== "COMPLETED" && status !== "CANCELLED";
  const diagnosticsFillable = canFillDiagnostics(status);
  const plannedDiagnostics = order.plannedDiagnostics;

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <nav className="flex items-center gap-1.5 text-[13px] text-[var(--oc-muted3)] mb-3">
        <Link href="/dashboard/orders" className="hover:text-[var(--oc-accent-hi)] transition-colors">
          Захиалгууд
        </Link>
        <span>/</span>
        <span className="text-[var(--oc-muted)]">#{order.number}</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--oc-ink)]">
            Захиалга #{order.number}
          </h1>
          <p className="text-sm text-[var(--oc-muted3)] mt-1">
            {customerLabel(order.customer)} · {order.vehicle.plate}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {order.isPostpaid ? (
            <span
              className={`font-plex-mono text-[11px] px-3 py-1.5 rounded-full ${POSTPAID_BADGE}`}
            >
              {POSTPAID_LABEL}
            </span>
          ) : null}
          <span
            className={`font-plex-mono text-[11px] px-3 py-1.5 rounded-full ${PAYMENT_STATUS_BADGE[paymentStatus]}`}
          >
            {PAYMENT_STATUS_LABEL[paymentStatus]}
          </span>
          <span
            className={`font-plex-mono text-[11px] px-3 py-1.5 rounded-full ${ORDER_STATUS_BADGE[status]}`}
          >
            {ORDER_STATUS_LABEL[status]}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <section className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] relative z-10">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--oc-line)]">
              <div>
                <h2 className="font-semibold text-[var(--oc-ink)]">Үйлчилгээ</h2>
                <p className="text-xs text-[var(--oc-muted3)] mt-0.5">
                  {order.items.length} үйлчилгээ · {reports.length}/
                  {plannedDiagnostics.length + reports.length} оношилгоо · нийт{" "}
                  <strong className="font-plex-mono text-[var(--oc-ink)]">
                    {formatTugrik(order.totalAmount?.toString() ?? "0")}
                  </strong>
                </p>
              </div>
              {diagnosticsFillable && activeTemplateCount > 0 ? (
                <BtnLink href={`/dashboard/orders/${order.id}/diagnostics/new`} size="sm" className="shrink-0">
                  + Шинэ оношилгоо
                </BtnLink>
              ) : activeTemplateCount === 0 && canEditOrder ? (
                <Link
                  href="/dashboard/services/diagnostics/new"
                  className="shrink-0 text-xs text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)]"
                >
                  Загвар үүсгэх →
                </Link>
              ) : null}
            </div>

            {order.items.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-[var(--oc-muted3)]">
                Үйлчилгээ нэмэгдээгүй байна. Доороос нэмнэ үү.
              </div>
            ) : (
              <OrderItems
                items={order.items.map((it) => ({
                  id: it.id,
                  kind: it.kind,
                  description: it.description,
                  quantity: it.quantity.toString(),
                  unitPrice: it.unitPrice.toString(),
                  total: it.total.toString(),
                }))}
                canEdit={isEditable && canEditOrder}
              />
            )}

            {/* Оношилгооны хуудас — товлосон (Бөглөх) ба бөглөгдсөн тайлан */}
            {plannedDiagnostics.length > 0 || reports.length > 0 ? (
              <div className="border-t border-[var(--oc-line)]">
                <div className="px-5 py-2 font-plex-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--oc-muted3)] bg-[var(--oc-panel2)]">
                  Оношилгооны хуудас
                </div>
                <div className="divide-y divide-[var(--oc-line)]">
                  {plannedDiagnostics.map((p) => {
                    const tp = p.template.type as DiagnosticType;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-3 px-5 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full ${DIAGNOSTIC_TYPE_BADGE[tp]}`}
                          >
                            {DIAGNOSTIC_TYPE_LABEL[tp]}
                          </span>
                          <div>
                            <div className="text-sm text-[var(--oc-ink)]">
                              {p.template.name}
                            </div>
                            <div className="text-xs text-amber-400/80 light:text-amber-700">
                              Бөглөгдөөгүй
                            </div>
                          </div>
                        </div>
                        {diagnosticsFillable ? (
                          <BtnLink
                            href={`/dashboard/orders/${order.id}/diagnostics/new?templateId=${p.template.id}`}
                            size="sm"
                            className="shrink-0"
                          >
                            Бөглөх
                          </BtnLink>
                        ) : (
                          <span className="shrink-0 text-[11px] text-[var(--oc-muted4)]">
                            {status === "SCHEDULED"
                              ? "Захиалга эхэлсний дараа"
                              : "—"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {reports.map((r) => {
                    const tp = r.template.type as DiagnosticType;
                    return (
                      <Link
                        key={r.id}
                        href={`/dashboard/diagnostics/reports/${r.id}`}
                        className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full ${DIAGNOSTIC_TYPE_BADGE[tp]}`}
                          >
                            {DIAGNOSTIC_TYPE_LABEL[tp]}
                          </span>
                          <div>
                            <div className="text-sm text-[var(--oc-ink)]">
                              {r.template.name}
                            </div>
                            <div className="text-xs text-[var(--oc-muted3)]">
                              {r.filledBy
                                ? `${r.filledBy.lastName} ${r.filledBy.firstName}`
                                : "—"}{" "}
                              · {r.createdAt.toLocaleString("mn-MN", { hour12: false })}
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 text-xs text-[var(--oc-accent)]">
                          Үзэх →
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {isEditable && canEditOrder ? (
              <div className="px-5 py-4 border-t border-[var(--oc-line)] bg-[var(--oc-panel2)]">
                <AddItemForm
                  orderId={order.id}
                  services={services.map((s) => ({
                    id: s.id,
                    type: s.type as ServiceKind,
                    name: s.name,
                    code: s.code,
                    unit: s.unit?.name ?? "",
                    price: s.price.toString(),
                    stock: s.stock != null ? s.stock.toString() : null,
                    laborCategoryId: s.categoryId,
                    laborCategoryName: s.category?.name ?? null,
                  }))}
                  diagnosticTemplates={diagnosticTemplates.map((t) => ({
                    id: t.id,
                    name: t.name,
                    price: t.price?.toString() ?? "0",
                    durationMin: t.durationMin,
                  }))}
                />
              </div>
            ) : null}
          </section>

          {isEditable && canEditOrder ? (
            <section className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-4 sm:p-5">
              <h2 className="font-semibold text-[var(--oc-ink)] mb-5">Захиалгын мэдээлэл</h2>
              <OrderForm
                initial={{
                  id: order.id,
                  branchId: order.branchId,
                  customerId: order.customerId,
                  vehicleId: order.vehicleId,
                  assignedToId: order.assignedToId,
                  scheduledAt: order.scheduledAt,
                  notes: order.notes,
                }}
                branches={branches}
                customers={customers}
                vehicles={vehicles}
                technicians={technicians}
                diagnosticTemplates={diagnosticTemplates.map((t) => ({
                  id: t.id,
                  name: t.name,
                  type: t.type as DiagnosticType,
                }))}
                initialDiagnosticTemplateIds={plannedDiagnostics.map(
                  (p) => p.template.id,
                )}
                allowDiagnosticEdit={status === "SCHEDULED"}
                backHref="/dashboard/orders"
              />
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-6">
          {/* Эцсийн төлөвт карт харуулахгүй — статус нь дээд badge-д аль
              хэдийн байгаа тул давхардана */}
          {allowedTransitions.length > 0 ? (
            <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-5">
              <h2 className="font-semibold text-[var(--oc-ink)] mb-4 text-sm">Статус</h2>
              <StatusControls
                orderId={order.id}
                transitions={allowedTransitions}
                disabled={!canEditOrder}
              />
            </div>
          ) : null}

          <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-[var(--oc-ink)] text-sm">Төлбөр</h2>
              <span
                className={`font-plex-mono text-[11px] px-2.5 py-1 rounded-full ${PAYMENT_STATUS_BADGE[paymentStatus]}`}
              >
                {PAYMENT_STATUS_LABEL[paymentStatus]}
              </span>
            </div>
            <dl className="space-y-2 text-sm mb-4">
              <div className="flex items-center justify-between">
                <dt className="text-[var(--oc-muted3)] text-xs">Нийт дүн</dt>
                <dd className="font-plex-mono text-[var(--oc-ink2)]">
                  {formatTugrik(order.totalAmount?.toString() ?? "0")}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[var(--oc-muted3)] text-xs">Төлсөн</dt>
                <dd className="font-plex-mono text-[var(--oc-ink2)]">
                  {order.paidAmount
                    ? formatTugrik(order.paidAmount.toString())
                    : "—"}
                </dd>
              </div>
              {order.paidAt ? (
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--oc-muted3)] text-xs">Төлсөн огноо</dt>
                  <dd className="font-plex-mono text-[var(--oc-ink2)] text-xs">
                    {order.paidAt.toLocaleString("mn-MN", { hour12: false })}
                  </dd>
                </div>
              ) : null}
            </dl>
            {order.isPostpaid ? (
              <p className="text-xs text-sky-400/90 light:text-sky-700 mb-4 -mt-1">
                Дараа төлбөрт захиалга — төлбөрийг гэрээгээр нэгтгэн төлнө.
              </p>
            ) : null}
            {canEditPayments ? (
              <PaymentControls
                orderId={order.id}
                paymentStatus={paymentStatus}
                totalAmount={
                  order.totalAmount ? order.totalAmount.toString() : "0"
                }
              />
            ) : null}
            {canEditPayments && paymentStatus !== "PAID" ? (
              <div className="mt-4 pt-4 border-t border-[var(--oc-line)]">
                <div className="font-plex-mono text-[10.5px] text-[var(--oc-muted3)] uppercase tracking-[0.1em] mb-2">
                  QPay
                </div>
                <QPayWidget
                  orderId={order.id}
                  qpayConfigured={qpayReady}
                  pending={
                    pendingOrderPayment
                      ? {
                          id: pendingOrderPayment.id,
                          qrImage: pendingOrderPayment.qrImage,
                          urls: Array.isArray(pendingOrderPayment.qpayUrls)
                            ? (pendingOrderPayment.qpayUrls as unknown as QPayBankUrl[])
                            : [],
                          amount: pendingOrderPayment.amount.toString(),
                        }
                      : null
                  }
                />
              </div>
            ) : null}
          </div>

          <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-5 text-sm">
            <h2 className="font-semibold text-[var(--oc-ink)] mb-4 text-sm">Дэлгэрэнгүй</h2>
            <dl className="space-y-3">
              <Row label="Үйлчлүүлэгч">
                <Link
                  href={`/dashboard/customers/${order.customer.id}`}
                  className="text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)]"
                >
                  {customerLabel(order.customer)}
                </Link>
                <div className="text-xs text-[var(--oc-muted3)]">
                  {order.customer.phone}
                </div>
              </Row>
              <Row label="Машин">
                <Link
                  href={`/dashboard/vehicles/${order.vehicle.id}`}
                  className="text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)]"
                >
                  {order.vehicle.make} {order.vehicle.model}
                </Link>
                <div className="font-plex-mono text-xs text-[var(--oc-muted3)]">
                  {order.vehicle.plate}
                  {order.vehicle.year ? ` · ${order.vehicle.year}` : ""}
                </div>
              </Row>
              <Row label="Салбар">{order.branch.name}</Row>
              <Row label="Хариуцагч">
                {order.assignedTo
                  ? `${order.assignedTo.lastName} ${order.assignedTo.firstName}`
                  : "—"}
              </Row>
              <Row label="Товлосон">
                {order.scheduledAt
                  ? order.scheduledAt.toLocaleString("mn-MN", {
                      year: "numeric",
                      month: "short",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })
                  : "—"}
              </Row>
              {order.startedAt ? (
                <Row label="Эхэлсэн">
                  {order.startedAt.toLocaleString("mn-MN", { hour12: false })}
                </Row>
              ) : null}
              {order.completedAt ? (
                <Row label="Дууссан">
                  {order.completedAt.toLocaleString("mn-MN", { hour12: false })}
                </Row>
              ) : null}
              {order.notes ? (
                <div className="pt-2 border-t border-[var(--oc-line)]">
                  <div className="text-[var(--oc-muted3)] text-xs mb-1">Тэмдэглэл</div>
                  <p className="text-sm text-[var(--oc-ink2)] leading-relaxed whitespace-pre-wrap">
                    {order.notes}
                  </p>
                </div>
              ) : null}
            </dl>
          </div>

          {canDeleteOrder ? (
            <form
              action={deleteOrderAction}
              className="rounded-[10px] border border-red-500/25 bg-[var(--oc-panel)] p-5"
            >
              <h2 className="font-semibold mb-2 text-sm text-red-400 light:text-red-600">
                Аюултай бүс
              </h2>
              <p className="text-xs text-[var(--oc-muted3)] mb-4">
                Захиалгыг устгасны дараа сэргээх боломжгүй.
              </p>
              <input type="hidden" name="id" value={order.id} />
              <Btn type="submit" variant="danger" className="w-full">
                Захиалгыг устгах
              </Btn>
            </form>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-[var(--oc-muted3)]">{label}</dt>
      <dd className="mt-0.5 text-[var(--oc-ink2)]">{children}</dd>
    </div>
  );
}

