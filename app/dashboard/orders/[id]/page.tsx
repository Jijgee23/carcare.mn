import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deleteOrderAction,
  removeOrderItemAction,
} from "@/app/_actions/orders";
import { PageHeader } from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import {
  ORDER_ASSIGNABLE_WHERE,
  branchScopeId,
  canDelete,
  canEdit,
  canView,
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
  ITEM_KIND_BADGE,
  ITEM_KIND_LABEL,
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TRANSITIONS,
  PAYMENT_STATUS_BADGE,
  PAYMENT_STATUS_LABEL,
  type ItemKind,
  type OrderStatus,
  type PaymentStatus,
  canFillDiagnostics,
  formatTugrik,
} from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { AddItemForm } from "./add-item-form";
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
  const scopeBranchId = branchScopeId(user);
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
    prisma.vehicle.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        plate: true,
        make: true,
        model: true,
        customerId: true,
      },
    }),
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
        laborCategoryId: true,
        laborCategory: { select: { name: true } },
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
      <PageHeader
        title={`Захиалга #${order.number}`}
        description={`${customerLabel(order.customer)} · ${order.vehicle.plate}`}
        actions={
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-3 py-1.5 rounded-full ${PAYMENT_STATUS_BADGE[paymentStatus]}`}
            >
              {PAYMENT_STATUS_LABEL[paymentStatus]}
            </span>
            <span
              className={`text-xs px-3 py-1.5 rounded-full ${ORDER_STATUS_BADGE[status]}`}
            >
              {ORDER_STATUS_LABEL[status]}
            </span>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <section className="glass rounded-xl relative z-10">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.06]">
              <div>
                <h2 className="font-semibold">Үйлчилгээ</h2>
                <p className="text-xs text-white/40 mt-0.5">
                  {order.items.length} үйлчилгээ · {reports.length}/
                  {plannedDiagnostics.length + reports.length} оношилгоо · нийт{" "}
                  <strong className="text-white">
                    {formatTugrik(order.totalAmount?.toString() ?? "0")}
                  </strong>
                </p>
              </div>
              {diagnosticsFillable && activeTemplateCount > 0 ? (
                <Link
                  href={`/dashboard/orders/${order.id}/diagnostics/new`}
                  className="shrink-0 text-xs bg-violet-600 hover:bg-violet-500 transition-colors px-3 py-1.5 rounded-lg font-medium"
                >
                  + Шинэ оношилгоо
                </Link>
              ) : activeTemplateCount === 0 && canEditOrder ? (
                <Link
                  href="/dashboard/services/diagnostics/new"
                  className="shrink-0 text-xs text-violet-300 hover:text-violet-200"
                >
                  Загвар үүсгэх →
                </Link>
              ) : null}
            </div>

            {order.items.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-white/40">
                Үйлчилгээ нэмэгдээгүй байна. Доороос нэмнэ үү.
              </div>
            ) : (
              <ItemsGroupedByKind
                items={order.items}
                canEdit={isEditable && canEditOrder}
              />
            )}

            {/* Оношилгооны хуудас — товлосон (Бөглөх) ба бөглөгдсөн тайлан */}
            {plannedDiagnostics.length > 0 || reports.length > 0 ? (
              <div className="border-t border-white/[0.06]">
                <div className="px-5 py-2 text-[11px] font-medium uppercase tracking-wide text-white/35 bg-white/[0.02]">
                  Оношилгооны хуудас
                </div>
                <div className="divide-y divide-white/[0.04]">
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
                            <div className="text-sm text-white/90">
                              {p.template.name}
                            </div>
                            <div className="text-xs text-amber-300/70">
                              Бөглөгдөөгүй
                            </div>
                          </div>
                        </div>
                        {diagnosticsFillable ? (
                          <Link
                            href={`/dashboard/orders/${order.id}/diagnostics/new?templateId=${p.template.id}`}
                            className="shrink-0 text-xs bg-violet-600 hover:bg-violet-500 transition-colors px-3 py-1.5 rounded-lg font-medium"
                          >
                            Бөглөх
                          </Link>
                        ) : (
                          <span className="shrink-0 text-[11px] text-white/30">
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
                            <div className="text-sm text-white/90">
                              {r.template.name}
                            </div>
                            <div className="text-xs text-white/40">
                              {r.filledBy
                                ? `${r.filledBy.lastName} ${r.filledBy.firstName}`
                                : "—"}{" "}
                              · {r.createdAt.toLocaleString("mn-MN")}
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 text-xs text-violet-300">
                          Үзэх →
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {isEditable && canEditOrder ? (
              <div className="px-5 py-4 border-t border-white/[0.06] bg-white/[0.02]">
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
                    laborCategoryId: s.laborCategoryId,
                    laborCategoryName: s.laborCategory?.name ?? null,
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
            <section className="glass rounded-xl p-4 sm:p-5 border border-white/[0.08]">
              <h2 className="font-semibold mb-5">Захиалгын мэдээлэл</h2>
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
          <div className="glass rounded-xl p-5">
            <h2 className="font-semibold mb-4 text-sm">Статус</h2>
            {allowedTransitions.length === 0 ? (
              <p className="text-xs text-white/40">
                Энэ статус эцсийн төлөв.
              </p>
            ) : (
              <StatusControls
                orderId={order.id}
                transitions={allowedTransitions}
                disabled={!canEditOrder}
              />
            )}
          </div>

          <div className="glass rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">Төлбөр</h2>
              <span
                className={`text-xs px-2.5 py-1 rounded-full ${PAYMENT_STATUS_BADGE[paymentStatus]}`}
              >
                {PAYMENT_STATUS_LABEL[paymentStatus]}
              </span>
            </div>
            <dl className="space-y-2 text-sm mb-4">
              <div className="flex items-center justify-between">
                <dt className="text-white/40 text-xs">Нийт дүн</dt>
                <dd className="text-white/80">
                  {formatTugrik(order.totalAmount?.toString() ?? "0")}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-white/40 text-xs">Төлсөн</dt>
                <dd className="text-white/80">
                  {order.paidAmount
                    ? formatTugrik(order.paidAmount.toString())
                    : "—"}
                </dd>
              </div>
              {order.paidAt ? (
                <div className="flex items-center justify-between">
                  <dt className="text-white/40 text-xs">Төлсөн огноо</dt>
                  <dd className="text-white/80 text-xs">
                    {order.paidAt.toLocaleString("mn-MN")}
                  </dd>
                </div>
              ) : null}
            </dl>
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
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <div className="text-xs text-white/50 uppercase tracking-wider mb-2">
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
                          qrText: pendingOrderPayment.qrText,
                          amount: pendingOrderPayment.amount.toString(),
                        }
                      : null
                  }
                />
              </div>
            ) : null}
          </div>

          <div className="glass rounded-xl p-5 text-sm">
            <h2 className="font-semibold mb-4 text-sm">Дэлгэрэнгүй</h2>
            <dl className="space-y-3">
              <Row label="Үйлчлүүлэгч">
                <Link
                  href={`/dashboard/customers/${order.customer.id}`}
                  className="text-violet-300 hover:text-violet-200"
                >
                  {customerLabel(order.customer)}
                </Link>
                <div className="text-xs text-white/40">
                  {order.customer.phone}
                </div>
              </Row>
              <Row label="Машин">
                <Link
                  href={`/dashboard/vehicles/${order.vehicle.id}`}
                  className="text-violet-300 hover:text-violet-200"
                >
                  {order.vehicle.make} {order.vehicle.model}
                </Link>
                <div className="text-xs text-white/40 font-mono">
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
                    })
                  : "—"}
              </Row>
              {order.startedAt ? (
                <Row label="Эхэлсэн">
                  {order.startedAt.toLocaleString("mn-MN")}
                </Row>
              ) : null}
              {order.completedAt ? (
                <Row label="Дууссан">
                  {order.completedAt.toLocaleString("mn-MN")}
                </Row>
              ) : null}
              {order.notes ? (
                <div className="pt-2 border-t border-white/[0.04]">
                  <div className="text-white/40 text-xs mb-1">Тэмдэглэл</div>
                  <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                    {order.notes}
                  </p>
                </div>
              ) : null}
            </dl>
          </div>

          {canDeleteOrder ? (
            <form
              action={deleteOrderAction}
              className="glass rounded-xl p-5 border border-red-500/20"
            >
              <h2 className="font-semibold mb-2 text-sm text-red-300">
                Аюултай бүс
              </h2>
              <p className="text-xs text-white/40 mb-4">
                Захиалгыг устгасны дараа сэргээх боломжгүй.
              </p>
              <input type="hidden" name="id" value={order.id} />
              <button
                type="submit"
                className="w-full text-sm font-medium bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 px-4 py-2 rounded-xl transition-colors"
              >
                Захиалгыг устгах
              </button>
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
      <dt className="text-xs text-white/40">{label}</dt>
      <dd className="mt-0.5 text-white/80">{children}</dd>
    </div>
  );
}

type OrderItem = {
  id: string;
  kind: string;
  description: string;
  quantity: { toString(): string };
  unitPrice: { toString(): string };
  total: { toString(): string };
};

// Үйлчилгээний мөрүүдийг төрлөөр нь бүлэглэн харуулна
const KIND_ORDER: ItemKind[] = ["LABOR", "DIAGNOSTIC", "PART", "FEE"];

function ItemsGroupedByKind({
  items,
  canEdit,
}: {
  items: OrderItem[];
  canEdit: boolean;
}) {
  const grouped = new Map<ItemKind, OrderItem[]>();
  for (const it of items) {
    const k = it.kind as ItemKind;
    const arr = grouped.get(k) ?? [];
    arr.push(it);
    grouped.set(k, arr);
  }

  // Тогтсон дарааллаар жагсаана (Ажил → Оношилгоо → Сэлбэг → Хураамж)
  const groups = KIND_ORDER.filter((k) => grouped.has(k)).map((k) => {
    const groupItems = grouped.get(k)!;
    const subtotal = groupItems.reduce(
      (acc, it) => acc + Number.parseFloat(it.total.toString()),
      0,
    );
    return { kind: k, items: groupItems, subtotal };
  });

  const grandTotal = groups.reduce((acc, g) => acc + g.subtotal, 0);

  return (
    <div className="divide-y divide-white/[0.04]">
      {groups.map((g) => {
        const subtotal = g.subtotal;
        return (
          <div key={g.kind}>
            <div className="flex items-center justify-between px-5 py-2.5 bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${ITEM_KIND_BADGE[g.kind]}`}
                >
                  {ITEM_KIND_LABEL[g.kind]}
                </span>
                <span className="text-xs text-white/40">
                  {g.items.length} мөр
                </span>
              </div>
              <div className="text-sm font-medium text-white/80">
                {formatTugrik(subtotal)}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    {["Нэр", "Тоо", "Нэгж үнэ", "Дүн", ""].map((h) => (
                      <th
                        key={h}
                        className="text-left text-[11px] text-white/30 font-medium px-5 py-2"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {g.items.map((it) => (
                    <tr
                      key={it.id}
                      className="border-b border-white/[0.04] last:border-0"
                    >
                      <td className="px-5 py-3 text-sm text-white/80">
                        {it.description}
                      </td>
                      <td className="px-5 py-3 text-sm text-white/60">
                        {it.quantity.toString()}
                      </td>
                      <td className="px-5 py-3 text-sm text-white/60">
                        {formatTugrik(it.unitPrice.toString())}
                      </td>
                      <td className="px-5 py-3 text-sm font-medium text-white/90">
                        {formatTugrik(it.total.toString())}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {canEdit ? (
                          <form action={removeOrderItemAction}>
                            <input type="hidden" name="itemId" value={it.id} />
                            <button
                              type="submit"
                              className="text-xs text-red-400 hover:text-red-300 transition-colors px-2.5 py-1 rounded-lg hover:bg-red-500/10"
                            >
                              Устгах
                            </button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <div className="px-5 py-4 bg-white/[0.03]">
        <div className="flex flex-col gap-1.5">
          {groups.map((g) => (
            <div
              key={g.kind}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${ITEM_KIND_BADGE[g.kind]}`}
                >
                  {ITEM_KIND_LABEL[g.kind]}
                </span>
                <span className="text-white/40 text-xs">
                  {g.items.length} мөр
                </span>
              </div>
              <div className="text-white/70 tabular-nums">
                {formatTugrik(g.subtotal)}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 mt-1 border-t border-white/[0.06]">
            <span className="text-sm font-semibold text-white/90">
              Нийт дүн
            </span>
            <span className="text-lg font-bold gradient-text tabular-nums">
              {formatTugrik(grandTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
