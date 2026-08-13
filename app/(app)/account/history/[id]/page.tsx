import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth/account";
import {
  ITEM_KIND_BADGE,
  ITEM_KIND_LABEL,
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_BADGE,
  PAYMENT_STATUS_LABEL,
  formatTugrik,
  type ItemKind,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/orders";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Үйлчилгээний дэлгэрэнгүй",
};

export const dynamic = "force-dynamic";

function fmtDateTime(d: Date | null): string {
  return d
    ? d.toLocaleString("mn-MN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    : "—";
}

function qtyText(q: string): string {
  const n = Number.parseFloat(q);
  return Number.isFinite(n) ? n.toLocaleString("mn-MN", { maximumFractionDigits: 3 }) : q;
}

export default async function AccountHistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const account = await requireAccount();
  const { id } = await params;

  // Эзэмшлийн машинууд (баталгаажсан холбоос) — түүхийн жагсаалттай ижил логик.
  const ownedLinks = await prisma.tenantVehicle.findMany({
    where: {
      OR: [
        { customer: { accountId: account.id } },
        { customer: { phone: { endsWith: account.phone } } },
      ],
    },
    select: { vehicleId: true },
    distinct: ["vehicleId"],
  });
  const ownedVehicleIds = ownedLinks.map((l) => l.vehicleId);

  // Зөвшөөрөл: захиалга нь account-тай холбоотой Customer-ийнх ЭСВЭЛ эзэмшлийн
  // машины захиалга байх ёстой. Өөр хэрэглэгчийн захиалгыг харах боломжгүй.
  const order = await prisma.serviceOrder.findFirst({
    where: {
      id,
      OR: [
        { customer: { accountId: account.id } },
        ...(ownedVehicleIds.length
          ? [{ vehicleId: { in: ownedVehicleIds } }]
          : []),
      ],
    },
    select: {
      number: true,
      status: true,
      paymentStatus: true,
      scheduledAt: true,
      completedAt: true,
      createdAt: true,
      notes: true,
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
          quantity: true,
          unitPrice: true,
          total: true,
        },
      },
    },
  });

  if (!order) notFound();

  return (
    <div className="w-full max-w-full flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold truncate">{order.tenant.name}</h1>
            <span className="text-xs text-white/30 font-mono">
              №{order.number}
            </span>
          </div>
          <p className="text-white/45 text-sm mt-0.5">
            {order.vehicle.plate} · {order.vehicle.make} {order.vehicle.model}
            {order.vehicle.year ? ` · ${order.vehicle.year}` : ""}
          </p>
        </div>
        <Link
          href="/account/history"
          className="shrink-0 text-sm text-white/50 hover:text-white border border-white/[0.1] hover:bg-white/[0.05] px-4 py-2 rounded-lg transition-colors"
        >
          ← Буцах
        </Link>
      </div>

      {/* Товч мэдээлэл */}
      <div className="glass rounded-2xl p-4 border border-white/[0.08] grid gap-3 sm:grid-cols-2">
        <Info label="Төлөв">
          <span
            className={`text-xs px-2.5 py-1 rounded-full ${ORDER_STATUS_BADGE[order.status as OrderStatus]}`}
          >
            {ORDER_STATUS_LABEL[order.status as OrderStatus]}
          </span>
        </Info>
        <Info label="Төлбөр">
          <span
            className={`text-xs px-2.5 py-1 rounded-full ${PAYMENT_STATUS_BADGE[order.paymentStatus as PaymentStatus]}`}
          >
            {PAYMENT_STATUS_LABEL[order.paymentStatus as PaymentStatus]}
          </span>
        </Info>
        <Info label="Салбар">
          <span className="text-sm text-white/80">
            {order.branch.name}
            {order.branch.phone ? (
              <span className="text-white/40"> · {order.branch.phone}</span>
            ) : null}
          </span>
        </Info>
        <Info label="Огноо">
          <span className="text-sm text-white/80 tabular-nums">
            {fmtDateTime(
              order.completedAt ?? order.scheduledAt ?? order.createdAt,
            )}
          </span>
        </Info>
      </div>

      {/* Үйлчилгээний мөрүүд */}
      <div>
        <h2 className="font-semibold text-white/80 text-sm mb-2">
          Хийгдсэн ажил, сэлбэг
          {order.items.length > 0 ? (
            <span className="text-white/35 font-normal">
              {" "}
              · {order.items.length}
            </span>
          ) : null}
        </h2>

        {order.items.length === 0 ? (
          <div className="glass rounded-2xl p-8 border border-white/[0.08] text-center text-sm text-white/40">
            Мөр бүртгэгдээгүй байна.
          </div>
        ) : (
          <div className="glass rounded-2xl border border-white/[0.08] overflow-hidden divide-y divide-white/[0.04]">
            {order.items.map((it) => (
              <div key={it.id} className="flex items-start gap-3 px-4 py-3">
                <span
                  className={`shrink-0 mt-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${ITEM_KIND_BADGE[it.kind as ItemKind]}`}
                >
                  {ITEM_KIND_LABEL[it.kind as ItemKind]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white/85">{it.description}</div>
                  <div className="text-xs text-white/40 mt-0.5 tabular-nums">
                    {qtyText(it.quantity.toString())} ×{" "}
                    {formatTugrik(it.unitPrice.toString())}
                  </div>
                </div>
                <div className="shrink-0 text-sm font-medium text-white/90 tabular-nums">
                  {formatTugrik(it.total.toString())}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Дүн */}
      <div className="glass rounded-2xl p-4 border border-white/[0.08] flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/50">Нийт дүн</span>
          <span className="font-bold text-white/90 tabular-nums text-base">
            {formatTugrik(order.totalAmount?.toString() ?? null)}
          </span>
        </div>
        {order.paidAmount != null ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Төлсөн</span>
            <span className="text-white/80 tabular-nums">
              {formatTugrik(order.paidAmount.toString())}
            </span>
          </div>
        ) : null}
      </div>

      {order.notes ? (
        <div className="glass rounded-2xl p-4 border border-white/[0.08]">
          <div className="text-xs text-white/40 mb-1">Тэмдэглэл</div>
          <p className="text-sm text-white/75 whitespace-pre-wrap">
            {order.notes}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Info({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/35 w-16 shrink-0">{label}</span>
      {children}
    </div>
  );
}
