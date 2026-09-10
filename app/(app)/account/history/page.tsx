import Link from "next/link";
import { Prisma } from "@/app/generated/prisma/client";
import { BtnLink, Chip } from "@/app/_components/landing-ops-ui";
import {
  APPOINTMENT_STATUS_BADGE,
  APPOINTMENT_STATUS_LABEL,
} from "@/lib/appointments";
import { requireAccount } from "@/lib/auth/account";
import { normalizePlate } from "@/lib/vehicles";
import {
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  formatTugrik,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/orders";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Үйлчилгээний түүх",
};

export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return d.toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default async function AccountHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ plate?: string }>;
}) {
  const account = await requireAccount();
  const { plate } = await searchParams;

  // Энэ account-ийн БАТАЛГААЖСАН эзэмшлийн машинууд: аль нэг байгууллагад
  // account-той холбоотой Customer-т бүртгэлтэй TenantVehicle (утсаар
  // баталгаажсан холбоос). AccountVehicle нь өөрөө claim хийдэг тул эзэмшлийн
  // нотолгоо БОЛОХГҮЙ — зөвхөн энэ баталгаатай холбоосыг ашиглана.
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

  // Cross-tenant түүх: эзэмшлийн машины БҮХ байгууллага дахь захиалга, мөн
  // account-той холбоотой Customer-ийн захиалга (хуучин зан төлөвтэй нийцүүлэв).
  // Машин нэг байгууллагад өөр (холбогдоогүй) Customer дээр бүртгэгдсэн ч,
  // эзэмшил нь өөр газар баталгаажсан бол түүх энд нэгдэж харагдана.
  // Түүх дууссан AND цуцлагдсан ажлыг харуулна (D-085) — SCHEDULED/IN_PROGRESS/
  // POSTPONED хараахан идэвхтэй, /account (Миний захиалгууд) дээр харагдана.
  // Төлбөрийн төлөв энд шүүлт биш: төлөгдөөгүй ч дууссан ажил энд харагдана.
  const where: Prisma.ServiceOrderWhereInput = {
    status: { in: ["COMPLETED", "CANCELLED"] },
    OR: [
      { customer: { accountId: account.id } },
      ...(ownedVehicleIds.length
        ? [{ vehicleId: { in: ownedVehicleIds } }]
        : []),
    ],
  };
  if (plate) where.vehicle = { plate: normalizePlate(plate) };

  const orders = await prisma.serviceOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      number: true,
      status: true,
      paymentStatus: true,
      scheduledAt: true,
      completedAt: true,
      createdAt: true,
      totalAmount: true,
      tenant: { select: { name: true } },
      branch: { select: { name: true } },
      vehicle: { select: { plate: true, make: true, model: true } },
      _count: { select: { items: true } },
    },
  });

  // D-085: цуцлагдсан/ирээгүй/татгалзсан цаг (ServiceOrder огт үүсээгүй тул
  // дээрх query-д тусахгүй) — эдгээр нь одоо идэвхтэй жагсаалтад (D-083/D-084)
  // байхгүй болсон тул, мөнхөд алга болохгүйн тулд энд харагдана. `plate`-ээр
  // шүүхгүй — цаг захиалахдаа машин сонгоогүй байж болно, мөн энэ бол цөөн
  // тооны бичлэг тул шүүлт хийх шаардлагагүй.
  const cancelledAppointments = await prisma.appointment.findMany({
    where: {
      accountId: account.id,
      status: { in: ["CANCELLED", "NO_SHOW", "REJECTED"] },
      serviceOrderId: null,
    },
    orderBy: { requestedAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      requestedAt: true,
      tenant: { select: { name: true } },
      branch: { select: { name: true } },
      category: { select: { name: true } },
    },
  });

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Үйлчилгээний түүх</h1>
          <p className="text-[var(--oc-muted3)] text-sm mt-0.5">
            {plate
              ? `${plate} — хийгдсэн үйлчилгээнүүд`
              : "Таны машинд хийгдсэн бүх үйлчилгээ"}
          </p>
        </div>
        <BtnLink href="/account" variant="ghost">
          ← Буцах
        </BtnLink>
      </div>

      {plate ? (
        <div className="flex items-center gap-2">
          <Chip tone="accent" bordered>
            {plate}
          </Chip>
          <Link
            href="/account/history"
            className="text-xs text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] transition-colors"
          >
            Бүх машины түүхийг харах
          </Link>
        </div>
      ) : null}

      {orders.length === 0 && cancelledAppointments.length === 0 ? (
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-10 text-center text-sm text-[var(--oc-muted3)]">
          Одоогоор хийгдсэн үйлчилгээ алга. Цаг захиалга баталгаажиж, үйлчилгээ
          хийгдсэний дараа энд харагдана.
        </div>
      ) : orders.length > 0 ? (
        <div className="flex flex-col gap-3">
          {orders.map((o) => {
            const when = o.completedAt ?? o.scheduledAt ?? o.createdAt;
            return (
              <Link
                key={o.id}
                href={`/account/history/${o.id}`}
                className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-4 block hover:bg-[var(--oc-panel2)] transition-colors"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[var(--oc-ink)]">
                        {o.tenant.name}
                      </span>
                      <span className="text-xs text-[var(--oc-muted3)] font-plex-mono">
                        №{o.number}
                      </span>
                      <span
                        className={`font-plex-mono text-[11px] px-2.5 py-1 rounded-full ${ORDER_STATUS_BADGE[o.status as OrderStatus]}`}
                      >
                        {ORDER_STATUS_LABEL[o.status as OrderStatus]}
                      </span>
                    </div>
                    <div className="text-sm text-[var(--oc-muted)] mt-1">
                      {o.vehicle.plate} · {o.vehicle.make} {o.vehicle.model}
                    </div>
                    <div className="text-xs text-[var(--oc-muted3)] mt-0.5 tabular-nums">
                      {formatDate(when)} · {o.branch.name} · {o._count.items} мөр
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-[var(--oc-ink)] tabular-nums">
                      {formatTugrik(o.totalAmount?.toString() ?? null)}
                    </div>
                    <div className="text-xs text-[var(--oc-muted3)] mt-0.5">
                      {PAYMENT_STATUS_LABEL[o.paymentStatus as PaymentStatus]}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : null}

      {cancelledAppointments.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold text-[var(--oc-ink2)] text-sm">
            Цуцлагдсан / ирээгүй цагууд
            <span className="text-[var(--oc-muted3)] font-normal">
              {" "}
              · {cancelledAppointments.length}
            </span>
          </h2>
          {cancelledAppointments.map((a) => (
            <Link
              key={a.id}
              href={`/account/appointments/${a.id}`}
              className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-4 block hover:bg-[var(--oc-panel2)] transition-colors"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[var(--oc-ink)]">
                      {a.tenant.name}
                    </span>
                    <span
                      className={`font-plex-mono text-[11px] px-2.5 py-1 rounded-full ${APPOINTMENT_STATUS_BADGE[a.status]}`}
                    >
                      {APPOINTMENT_STATUS_LABEL[a.status]}
                    </span>
                  </div>
                  {a.category ? (
                    <div className="text-sm text-[var(--oc-muted)] mt-1">
                      {a.category.name}
                    </div>
                  ) : null}
                  <div className="text-xs text-[var(--oc-muted3)] mt-0.5 tabular-nums">
                    {formatDate(a.requestedAt)} · {a.branch.name}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
