import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Btn, BtnLink } from "@/app/_components/landing-ops-ui";
import { requireUser } from "@/lib/auth";
import { canEdit } from "@/lib/auth/roles";
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
import { VEHICLE_FORM_ID, VehicleForm } from "../vehicle-form";

export const metadata = {
  title: "Машины дэлгэрэнгүй",
};

function fmtDate(d: Date | null): string {
  return d
    ? d.toLocaleDateString("mn-MN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : "—";
}

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!canEdit(user, "vehicles")) redirect("/dashboard/vehicles");

  const { id } = await params;

  // id = global vehicleId. Тенантын link-ээр дамжуулж ачаална (харьяалал link дээр).
  const [link, customers, orders, appointments, plateHistory] = await Promise.all([
    prisma.tenantVehicle.findUnique({
      where: {
        tenantId_vehicleId: { tenantId: user.tenantId, vehicleId: id },
      },
      select: { customerId: true, isPostpaid: true, vehicle: true },
    }),
    prisma.customer.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, phone: true },
    }),
    // Энэ машины ЭНЭ tenant дахь захиалгууд (дэлгэрэнгүй рүү линктэй).
    prisma.serviceOrder.findMany({
      where: { tenantId: user.tenantId, vehicleId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        number: true,
        status: true,
        paymentStatus: true,
        scheduledAt: true,
        completedAt: true,
        createdAt: true,
        totalAmount: true,
        branch: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
    // Энэ машины цаг захиалгын түүх.
    prisma.appointment.findMany({
      where: { tenantId: user.tenantId, vehicleId: id },
      orderBy: { requestedAt: "desc" },
      select: {
        id: true,
        status: true,
        requestedAt: true,
        note: true,
        branch: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
    // Энэ машины дугаар өмнө нь солигдсон эсэх.
    prisma.vehiclePlateHistory.findMany({
      where: { vehicleId: id },
      orderBy: { changedAt: "desc" },
      select: { id: true, plate: true, changedAt: true },
    }),
  ]);

  if (!link) notFound();
  const vehicle = link.vehicle;

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <nav className="flex items-center gap-1.5 text-[13px] text-[var(--oc-muted3)] mb-3">
        <Link href="/dashboard/vehicles" className="hover:text-[var(--oc-accent-hi)] transition-colors">
          Машинууд
        </Link>
        <span>/</span>
        <span className="text-[var(--oc-muted)]">{vehicle.make} {vehicle.model}</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--oc-ink)]">
            {vehicle.make} {vehicle.model}
          </h1>
          <p className="font-plex-mono text-sm text-[var(--oc-muted3)] mt-1">{vehicle.plate}</p>
        </div>
        <div className="flex items-center gap-2">
          <BtnLink href="/dashboard/vehicles" variant="ghost">
            ← Буцах
          </BtnLink>
          <Btn type="submit" form={VEHICLE_FORM_ID}>
            Хадгалах
          </Btn>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Машины бүх мэдээлэл + HUR шинэчлэх (form дотор товчтой) */}
        <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-4 sm:p-5">
          <h2 className="font-semibold text-[var(--oc-ink)] text-sm mb-4">Машины мэдээлэл</h2>
          <VehicleForm
            initial={{
              id: vehicle.id,
              plate: vehicle.plate,
              vin: vehicle.vin,
              make: vehicle.make,
              model: vehicle.model,
              year: vehicle.year,
              mileage: vehicle.mileage,
              fuelType: vehicle.fuelType,
              wheelPosition: vehicle.wheelPosition,
              colorName: vehicle.colorName,
              capacity: vehicle.capacity,
              purpose: vehicle.purpose,
              ownerRegnum: vehicle.ownerRegnum,
              customerId: link.customerId,
              isPostpaid: link.isPostpaid,
            }}
            customers={customers}
          />
        </div>

        {/* items-start: карт бүр өөрийн контентын өндөртэй — сунаж хоосон
            орон зай үүсгэхгүй */}
        <div className="grid gap-6 lg:grid-cols-2 items-start">
          {/* Захиалгууд */}
          <section className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--oc-line)]">
              <h2 className="font-semibold text-[var(--oc-ink)] text-sm">Захиалгууд</h2>
              <div className="flex items-center gap-3">
                <span className="font-plex-mono text-xs text-[var(--oc-muted3)]">{orders.length}</span>
                {orders.length > 0 ? (
                  <Link
                    href={`/dashboard/orders?q=${encodeURIComponent(vehicle.plate)}`}
                    className="text-xs text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] transition-colors"
                  >
                    Бүгдийг харах →
                  </Link>
                ) : null}
              </div>
            </div>
            {orders.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-[var(--oc-muted3)]">
                Энэ машинд захиалга байхгүй байна.
              </div>
            ) : (
              <ul className="divide-y divide-[var(--oc-line)]">
                {orders.map((o) => {
                  const when = o.completedAt ?? o.scheduledAt ?? o.createdAt;
                  return (
                    <li key={o.id}>
                      <Link
                        href={`/dashboard/orders/${o.id}`}
                        className="flex items-start justify-between gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-plex-mono text-sm font-semibold text-[var(--oc-ink2)]">
                              №{o.number}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${ORDER_STATUS_BADGE[o.status as OrderStatus]}`}
                            >
                              {ORDER_STATUS_LABEL[o.status as OrderStatus]}
                            </span>
                          </div>
                          <div className="text-xs text-[var(--oc-muted3)] mt-1 tabular-nums">
                            {fmtDate(when)} · {o.branch.name} · {o._count.items}{" "}
                            мөр
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-plex-mono text-sm font-semibold text-[var(--oc-ink)] tabular-nums">
                            {formatTugrik(o.totalAmount?.toString() ?? null)}
                          </div>
                          <div className="text-xs text-[var(--oc-muted3)]">
                            {
                              PAYMENT_STATUS_LABEL[
                                o.paymentStatus as PaymentStatus
                              ]
                            }
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Цаг захиалгын түүх */}
          <section className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--oc-line)]">
              <h2 className="font-semibold text-[var(--oc-ink)] text-sm">Цаг захиалгын түүх</h2>
              <span className="font-plex-mono text-xs text-[var(--oc-muted3)]">
                {appointments.length}
              </span>
            </div>
            {appointments.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-[var(--oc-muted3)]">
                Цаг захиалга байхгүй байна.
              </div>
            ) : (
              <ul className="divide-y divide-[var(--oc-line)]">
                {appointments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-plex-mono text-sm text-[var(--oc-ink2)] tabular-nums">
                          {a.requestedAt.toLocaleString("mn-MN", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${APPOINTMENT_STATUS_BADGE[a.status as AppointmentStatus]}`}
                        >
                          {APPOINTMENT_STATUS_LABEL[a.status as AppointmentStatus]}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--oc-muted3)] mt-1">
                        {a.branch.name}
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

        {plateHistory.length > 0 ? (
          <section className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--oc-line)]">
              <h2 className="font-semibold text-[var(--oc-ink)] text-sm">Дугаарын түүх</h2>
              <span className="font-plex-mono text-xs text-[var(--oc-muted3)]">{plateHistory.length}</span>
            </div>
            <ul className="divide-y divide-[var(--oc-line)]">
              {plateHistory.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between gap-3 px-5 py-3.5"
                >
                  <span className="font-plex-mono text-sm text-[var(--oc-muted2)]">
                    {h.plate}
                  </span>
                  <span className="font-plex-mono text-xs text-[var(--oc-muted3)] tabular-nums">
                    {fmtDate(h.changedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
