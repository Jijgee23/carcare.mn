import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth/account";
import {
  APPOINTMENT_STATUS_BADGE,
  APPOINTMENT_STATUS_LABEL,
  type AppointmentStatus,
} from "@/lib/appointments";
import {
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  formatTugrik,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/orders";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Машины дэлгэрэнгүй" };
export const dynamic = "force-dynamic";

function fmtDate(d: Date | null): string {
  return d
    ? d.toLocaleDateString("mn-MN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : "—";
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

export default async function AccountVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const account = await requireAccount();
  const { id } = await params;

  // Эзэмшил баталгаажуулна: өөрөө нэмсэн (AccountVehicle) ЭСВЭЛ account/утсаар
  // холбогдсон tenant Customer-ийн машин. Бусдын машиныг харахаас сэргийлнэ.
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id,
      OR: [
        { accountLinks: { some: { accountId: account.id } } },
        { tenantLinks: { some: { customer: { accountId: account.id } } } },
        {
          tenantLinks: {
            some: { customer: { phone: { endsWith: account.phone } } },
          },
        },
      ],
    },
    select: {
      id: true,
      plate: true,
      make: true,
      model: true,
      year: true,
      vin: true,
      mileage: true,
      colorName: true,
      capacity: true,
      purpose: true,
      fuelType: true,
      wheelPosition: true,
    },
  });
  if (!vehicle) notFound();

  // Бүх tenant дамнасан түүх (эзэмшигчид нээлттэй — Phase 3 шийдвэр).
  const [orders, appointments] = await Promise.all([
    prisma.serviceOrder.findMany({
      where: { vehicleId: id },
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
        _count: { select: { items: true } },
      },
    }),
    prisma.appointment.findMany({
      where: { vehicleId: id },
      orderBy: { requestedAt: "desc" },
      take: 100,
      select: {
        id: true,
        status: true,
        requestedAt: true,
        note: true,
        tenant: { select: { name: true } },
        branch: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
  ]);

  const attrs: [string, string | null][] = [
    ["Өнгө", vehicle.colorName],
    ["Моторын хэмжээ", vehicle.capacity ? `${vehicle.capacity} см³` : null],
    ["Шатахуун", vehicle.fuelType],
    ["Жолооны хүрд", vehicle.wheelPosition],
    ["Зориулалт", vehicle.purpose],
    ["VIN", vehicle.vin],
    ["Гүйлт", vehicle.mileage != null ? `${vehicle.mileage.toLocaleString("mn-MN")} км` : null],
  ];

  return (
    <div className="w-full flex flex-col gap-6">
      <Link
        href="/account"
        className="text-sm text-white/40 hover:text-white/70 transition-colors"
      >
        ← Миний машинууд
      </Link>

      {/* Машины бүх мэдээлэл */}
      <div className="glass rounded-2xl p-5 border border-white/[0.08]">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tabular-nums">{vehicle.plate}</h1>
          <span className="text-white/50">
            {vehicle.make} {vehicle.model}
            {vehicle.year ? ` · ${vehicle.year}` : ""}
          </span>
        </div>
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 mt-4">
          {attrs
            .filter(([, val]) => val)
            .map(([label, val]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 text-sm border-b border-white/[0.04] pb-1.5"
              >
                <span className="text-white/40">{label}</span>
                <span className="text-white/80 text-right">{val}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Захиалгууд (бүх tenant) */}
      <section className="glass rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h2 className="font-semibold">Үйлчилгээний захиалга</h2>
          <span className="text-xs text-white/40">{orders.length}</span>
        </div>
        {orders.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-white/40">
            Энэ машинд хийгдсэн үйлчилгээ алга байна.
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {orders.map((o) => {
              const when = o.completedAt ?? o.scheduledAt ?? o.createdAt;
              return (
                <li
                  key={o.id}
                  className="flex items-start justify-between gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white/90">
                        {o.tenant.name}
                      </span>
                      <span className="text-xs text-white/30 font-mono">
                        №{o.number}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${ORDER_STATUS_BADGE[o.status as OrderStatus]}`}
                      >
                        {ORDER_STATUS_LABEL[o.status as OrderStatus]}
                      </span>
                    </div>
                    <div className="text-xs text-white/40 mt-1 tabular-nums">
                      {fmtDate(when)} · {o.branch.name} · {o._count.items} мөр
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-white/90 tabular-nums">
                      {formatTugrik(o.totalAmount?.toString() ?? null)}
                    </div>
                    <div className="text-xs text-white/40">
                      {PAYMENT_STATUS_LABEL[o.paymentStatus as PaymentStatus]}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Цаг захиалгын түүх (бүх tenant) */}
      <section className="glass rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h2 className="font-semibold">Цаг захиалгын түүх</h2>
          <span className="text-xs text-white/40">{appointments.length}</span>
        </div>
        {appointments.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-white/40">
            Цаг захиалга байхгүй байна.
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {appointments.map((a) => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-3 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white/90">
                      {a.tenant.name}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${APPOINTMENT_STATUS_BADGE[a.status as AppointmentStatus]}`}
                    >
                      {APPOINTMENT_STATUS_LABEL[a.status as AppointmentStatus]}
                    </span>
                  </div>
                  <div className="text-xs text-white/40 mt-1 tabular-nums">
                    {fmtDateTime(a.requestedAt)} · {a.branch.name}
                    {a.category ? ` · ${a.category.name}` : ""}
                    {a.note ? ` · ${a.note}` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
