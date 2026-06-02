import Link from "next/link";
import { Prisma } from "@/app/generated/prisma/client";
import {
  DateRangeFilter,
  FilterSelect,
  ResetFilters,
  SearchBox,
} from "@/app/_components/list-filters";
import {
  PageHeader,
  PrimaryLinkButton,
} from "@/app/_components/page-header";
import { requireUser } from "@/lib/auth";
import { canCreate, canView } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import {
  ITEM_KIND_BADGE,
  ITEM_KIND_LABEL,
  ORDER_STATUSES,
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_BADGE,
  PAYMENT_STATUS_LABEL,
  type ItemKind,
  type OrderStatus,
  type PaymentStatus,
  formatTugrik,
} from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { OrderRow } from "./order-row";

export const metadata = {
  title: "Захиалга",
};

const FILTERS: { value: "all" | OrderStatus; label: string }[] = [
  { value: "all", label: "Бүгд" },
  { value: "SCHEDULED", label: ORDER_STATUS_LABEL.SCHEDULED },
  { value: "IN_PROGRESS", label: ORDER_STATUS_LABEL.IN_PROGRESS },
  { value: "WAITING_PARTS", label: ORDER_STATUS_LABEL.WAITING_PARTS },
  { value: "COMPLETED", label: ORDER_STATUS_LABEL.COMPLETED },
  { value: "CANCELLED", label: ORDER_STATUS_LABEL.CANCELLED },
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    branchId?: string;
    paymentStatus?: string;
    customerId?: string;
    vehicleId?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}) {
  const user = await requireUser();
  if (!canView(user, "orders")) redirect("/dashboard");
  const canAdd = canCreate(user, "orders");

  const {
    status: statusParam,
    q = "",
    branchId = "",
    paymentStatus = "",
    customerId = "",
    vehicleId = "",
    dateFrom = "",
    dateTo = "",
  } = await searchParams;
  const status =
    statusParam && (ORDER_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as OrderStatus)
      : null;

  const where: Prisma.ServiceOrderWhereInput = {
    tenantId: user.tenantId,
    ...(status ? { status } : {}),
  };
  if (branchId) where.branchId = branchId;
  if (customerId) where.customerId = customerId;
  if (vehicleId) where.vehicleId = vehicleId;
  if (
    paymentStatus &&
    ["UNPAID", "PARTIAL", "PAID"].includes(paymentStatus)
  ) {
    where.paymentStatus = paymentStatus as PaymentStatus;
  }
  // Огнооны муж — товлосон огноо (scheduledAt)-аар шүүнэ
  const scheduledAt: Prisma.DateTimeFilter = {};
  if (dateFrom) scheduledAt.gte = new Date(`${dateFrom}T00:00:00`);
  if (dateTo) scheduledAt.lte = new Date(`${dateTo}T23:59:59.999`);
  if (scheduledAt.gte || scheduledAt.lte) where.scheduledAt = scheduledAt;
  if (q) {
    where.OR = [
      { number: { contains: q, mode: "insensitive" } },
      { customer: { fullName: { contains: q, mode: "insensitive" } } },
      { customer: { phone: { contains: q } } },
      { vehicle: { plate: { contains: q, mode: "insensitive" } } },
      { vehicle: { make: { contains: q, mode: "insensitive" } } },
      { vehicle: { model: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [orders, counts, branches, customers, vehicles] = await Promise.all([
    prisma.serviceOrder.findMany({
      where,
      orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
      include: {
        customer: { select: { fullName: true } },
        vehicle: { select: { plate: true, make: true, model: true } },
        branch: { select: { name: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
        items: {
          orderBy: { createdAt: "asc" },
          take: 3,
          select: { id: true, description: true, kind: true },
        },
        _count: { select: { items: true } },
      },
    }),
    prisma.serviceOrder.groupBy({
      by: ["status"],
      where: { tenantId: user.tenantId },
      _count: { _all: true },
    }),
    prisma.branch.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.customer.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, phone: true },
    }),
    prisma.vehicle.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { plate: "asc" },
      select: { id: true, plate: true, make: true, model: true },
    }),
  ]);

  const countByStatus = Object.fromEntries(
    counts.map((c) => [c.status, c._count._all]),
  );
  const total = counts.reduce((a, c) => a + c._count._all, 0);

  return (
    <div className="p-6 sm:p-8 max-full flex-1 flex flex-col min-h-0 w-full">
      <PageHeader
        title="Захиалга"
        description="Бүх ажил, статус, орлогын бүртгэл"
        actions={
          canAdd ? (
            <PrimaryLinkButton href="/dashboard/orders/new">
              Захиалга үүсгэх
            </PrimaryLinkButton>
          ) : null
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Нийт" value={total} color="text-white" />
        <StatCard
          label={ORDER_STATUS_LABEL.SCHEDULED}
          value={countByStatus.SCHEDULED ?? 0}
          color="text-amber-400"
        />
        <StatCard
          label={ORDER_STATUS_LABEL.IN_PROGRESS}
          value={countByStatus.IN_PROGRESS ?? 0}
          color="text-blue-400"
        />
        <StatCard
          label={ORDER_STATUS_LABEL.COMPLETED}
          value={countByStatus.COMPLETED ?? 0}
          color="text-emerald-400"
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "1rem",
          flexWrap: "wrap",
        }}
      >
        <SearchBox placeholder="№, үйлчлүүлэгч, машинаар хайх" />
        <FilterSelect
          paramName="branchId"
          placeholder="Бүх салбар"
          options={branches.map((b) => ({ value: b.id, label: b.name }))}
        />
        <FilterSelect
          paramName="customerId"
          placeholder="Бүх үйлчлүүлэгч"
          searchable
          searchPlaceholder="Үйлчлүүлэгч хайх..."
          options={customers.map((c) => ({
            value: c.id,
            label: c.fullName,
            hint: c.phone,
          }))}
        />
        <FilterSelect
          paramName="vehicleId"
          placeholder="Бүх машин"
          searchable
          searchPlaceholder="Дугаар, маркаар хайх..."
          options={vehicles.map((v) => ({
            value: v.id,
            label: v.plate,
            hint: `${v.make} ${v.model}`,
          }))}
        />
        <FilterSelect
          paramName="paymentStatus"
          placeholder="Бүх төлбөр"
          options={[
            { value: "UNPAID", label: PAYMENT_STATUS_LABEL.UNPAID },
            { value: "PARTIAL", label: PAYMENT_STATUS_LABEL.PARTIAL },
            { value: "PAID", label: PAYMENT_STATUS_LABEL.PAID },
          ]}
        />
        <DateRangeFilter label="Товлосон" />
        <ResetFilters
          paramNames={[
            "q",
            "branchId",
            "customerId",
            "vehicleId",
            "paymentStatus",
            "dateFrom",
            "dateTo",
            "status",
          ]}
        />
      </div>

      <div className="glass rounded-2xl overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => {
            const active =
              (f.value === "all" && !status) || f.value === status;
            return (
              <Link
                key={f.value}
                href={
                  f.value === "all"
                    ? "/dashboard/orders"
                    : `/dashboard/orders?status=${f.value}`
                }
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  active
                    ? "bg-violet-600/30 text-violet-300 border border-violet-500/30"
                    : "text-white/40 hover:text-white/70 border border-white/10 hover:border-white/20"
                }`}
              >
                {f.label}
              </Link>
            );
          })}
          <div className="ml-auto text-xs text-white/30">
            {orders.length} захиалга
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="px-5 py-16 text-center text-white/40 text-sm flex-1">
            {status
              ? "Энэ статуст захиалга алга."
              : "Захиалга алга байна. Эхний захиалгаа үүсгээрэй."}
          </div>
        ) : (
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {[
                    "#",
                    "Үйлчлүүлэгч",
                    "Машин",
                    "Үйлчилгээ",
                    "Салбар",
                    "Хариуцагч",
                    "Огноо",
                    "Дүн",
                    "Статус",
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
                {orders.map((o) => (
                  <OrderRow
                    key={o.id}
                    href={`/dashboard/orders/${o.id}`}
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/dashboard/orders/${o.id}`}
                        className="font-mono text-sm font-semibold text-violet-300 hover:text-violet-200"
                      >
                        #{o.number}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-sm text-white/80">
                      {o.customer.fullName}
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <div className="text-white/80">
                        {o.vehicle.make} {o.vehicle.model}
                      </div>
                      <div className="text-xs text-white/30 font-mono">
                        {o.vehicle.plate}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {o._count.items === 0 ? (
                        <span className="text-white/30">—</span>
                      ) : (
                        <div className="flex flex-col gap-1 max-w-[220px]">
                          {o.items.map((it) => (
                            <div
                              key={it.id}
                              className="flex items-center gap-1.5"
                            >
                              <span
                                className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${
                                  ITEM_KIND_BADGE[it.kind as ItemKind]
                                }`}
                              >
                                {ITEM_KIND_LABEL[it.kind as ItemKind]}
                              </span>
                              <span className="text-white/70 truncate">
                                {it.description}
                              </span>
                            </div>
                          ))}
                          {o._count.items > o.items.length ? (
                            <span className="text-white/30">
                              +{o._count.items - o.items.length} өөр
                            </span>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-white/50">
                      {o.branch.name}
                    </td>
                    <td className="px-5 py-4 text-sm text-white/50">
                      {o.assignedTo
                        ? `${o.assignedTo.lastName} ${o.assignedTo.firstName}`
                        : "—"}
                    </td>
                    <td className="px-5 py-4 text-xs text-white/40">
                      {o.scheduledAt
                        ? o.scheduledAt.toLocaleString("mn-MN", {
                            year: "numeric",
                            month: "short",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <div className="text-white/80">
                        {formatTugrik(
                          o.totalAmount ? o.totalAmount.toString() : null,
                        )}
                      </div>
                      <span
                        className={`mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded-full ${
                          PAYMENT_STATUS_BADGE[o.paymentStatus as PaymentStatus]
                        }`}
                      >
                        {PAYMENT_STATUS_LABEL[o.paymentStatus as PaymentStatus]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full ${
                          ORDER_STATUS_BADGE[o.status as OrderStatus]
                        }`}
                      >
                        {ORDER_STATUS_LABEL[o.status as OrderStatus]}
                      </span>
                    </td>
                  </OrderRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="glass rounded-xl p-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-white/40 mt-1">{label}</div>
    </div>
  );
}
