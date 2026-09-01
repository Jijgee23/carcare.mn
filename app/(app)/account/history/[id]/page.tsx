import { notFound } from "next/navigation";
import { BtnLink } from "@/app/_components/landing-ops-ui";
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
            <span className="text-xs text-[var(--oc-muted3)] font-plex-mono">
              №{order.number}
            </span>
          </div>
          <p className="text-[var(--oc-muted)] text-sm mt-0.5">
            {order.vehicle.plate} · {order.vehicle.make} {order.vehicle.model}
            {order.vehicle.year ? ` · ${order.vehicle.year}` : ""}
          </p>
        </div>
        <BtnLink href="/account/history" variant="ghost" className="shrink-0">
          ← Буцах
        </BtnLink>
      </div>

      {/* Товч мэдээлэл */}
      <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-5 grid gap-3 sm:grid-cols-2">
        <Info label="Төлөв">
          <span
            className={`font-plex-mono text-[11px] px-2.5 py-1 rounded-full ${ORDER_STATUS_BADGE[order.status as OrderStatus]}`}
          >
            {ORDER_STATUS_LABEL[order.status as OrderStatus]}
          </span>
        </Info>
        <Info label="Төлбөр">
          <span
            className={`font-plex-mono text-[11px] px-2.5 py-1 rounded-full ${PAYMENT_STATUS_BADGE[order.paymentStatus as PaymentStatus]}`}
          >
            {PAYMENT_STATUS_LABEL[order.paymentStatus as PaymentStatus]}
          </span>
        </Info>
        <Info label="Салбар">
          <span className="text-sm text-[var(--oc-ink2)]">
            {order.branch.name}
            {order.branch.phone ? (
              <span className="text-[var(--oc-muted3)]"> · {order.branch.phone}</span>
            ) : null}
          </span>
        </Info>
        <Info label="Огноо">
          <span className="text-sm text-[var(--oc-ink2)] tabular-nums">
            {fmtDateTime(
              order.completedAt ?? order.scheduledAt ?? order.createdAt,
            )}
          </span>
        </Info>
      </div>

      {/* Үйлчилгээний мөрүүд */}
      <div>
        <h2 className="font-semibold text-[var(--oc-ink2)] text-sm mb-2">
          Хийгдсэн ажил, сэлбэг
          {order.items.length > 0 ? (
            <span className="text-[var(--oc-muted3)] font-normal">
              {" "}
              · {order.items.length}
            </span>
          ) : null}
        </h2>

        {order.items.length === 0 ? (
          <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-8 text-center text-sm text-[var(--oc-muted3)]">
            Мөр бүртгэгдээгүй байна.
          </div>
        ) : (
          <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden divide-y divide-[var(--oc-line)]">
            {order.items.map((it) => (
              <div key={it.id} className="flex items-start gap-3 px-4 py-3">
                <span
                  className={`shrink-0 mt-0.5 font-plex-mono text-[10px] px-1.5 py-0.5 rounded-full ${ITEM_KIND_BADGE[it.kind as ItemKind]}`}
                >
                  {ITEM_KIND_LABEL[it.kind as ItemKind]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-[var(--oc-ink2)]">{it.description}</div>
                  <div className="text-xs text-[var(--oc-muted3)] mt-0.5 tabular-nums">
                    {qtyText(it.quantity.toString())} ×{" "}
                    {formatTugrik(it.unitPrice.toString())}
                  </div>
                </div>
                <div className="shrink-0 text-sm font-medium text-[var(--oc-ink)] tabular-nums">
                  {formatTugrik(it.total.toString())}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Дүн */}
      <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-5 flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--oc-muted)]">Нийт дүн</span>
          <span className="font-bold text-[var(--oc-ink)] tabular-nums text-base">
            {formatTugrik(order.totalAmount?.toString() ?? null)}
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

      {order.notes ? (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-5">
          <div className="font-plex-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--oc-muted3)] mb-1">
            Тэмдэглэл
          </div>
          <p className="text-sm text-[var(--oc-ink2)] whitespace-pre-wrap">
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
      <span className="font-plex-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--oc-muted3)] w-20 shrink-0">
        {label}
      </span>
      {children}
    </div>
  );
}
