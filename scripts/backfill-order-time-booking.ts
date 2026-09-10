/**
 * D-068 (COWORK.md): `OrderTimeBooking` (харах: 20260910140000_order_time_booking)
 * ЗӨВХӨН шинээр нэмэгдсэн, шинэ захиалгад хамаарна — миграцийн өмнөх бүх
 * `ServiceOrder` мөр одоо ямар ч booking мөргүй ("хоосон" түүхтэй). Энэ нэг
 * удаагийн скрипт тэдгээрт яг одоогийн бодит төлөвийг (scheduledAt/startedAt/
 * expectedFinishAt/occupiesCapacity-аас) толилуулсан НЭГ OrderTimeBooking мөр
 * үүсгэнэ — шинэ түүх зохион байгуулахгүй, зөвхөн одоо байгаа нэг töлөвийг
 * шинэ хэлбэрт шилжүүлнэ. Яг хэзээ release/resume хийгдсэн эсэхийг мэдэхгүй
 * тул (хуучин загвар түүхийг хадгалдаггүй байсан) closedAt-г ойролцоогоор
 * `updatedAt`-аар орлуулна — зөвхөн боломжтой хамгийн сайн ойролцоолол.
 *
 * Идэмпотент: аль хэдийн ≥1 booking-той захиалгыг алгасна тул дахин
 * ажиллуулахад аюулгүй (давхардуулахгүй).
 *
 * Эхлээд тоолж хараарай (dry-run, өөрчлөлт хийхгүй):
 *   npx tsx scripts/backfill-order-time-booking.ts --dry-run
 *
 * Дараа нь бодитоор гүйцэтгэх бол:
 *   npx tsx scripts/backfill-order-time-booking.ts
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";
import type { Prisma } from "@/app/generated/prisma/client";
import { resolveOrderEffectiveInterval } from "@/lib/schedule-order-interval";

type PlannedBooking = {
  orderId: string;
  tenantId: string;
  branchId: string;
  kind: "SCHEDULED" | "ACTIVE";
  startAt: Date;
  endAt: Date | null;
  closedAt: Date | null;
};

function planBooking(order: {
  id: string;
  tenantId: string;
  branchId: string;
  status: string;
  scheduledAt: Date | null;
  startedAt: Date | null;
  estimatedDurationMinutes: number | null;
  expectedFinishAt: Date | null;
  occupiesCapacity: boolean | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): PlannedBooking {
  const base = {
    orderId: order.id,
    tenantId: order.tenantId,
    branchId: order.branchId,
  };

  // Эх бодит логик lib/schedule-order-interval.ts-д нэгтгэгдсэн тул энд
  // давхардуулахгүй, шууд дуудна — ингэснээр энэ нэг удаагийн backfill скрипт
  // хэзээ ч тухайн эх логикоос зөрөхгүй (өмнө нь SCHEDULED-ийн
  // estimatedDurationMinutes-аас гарсан төгсгөлийг орхигдуулж байсан алдаа
  // энэ дундаас гарсан — COWORK.md, 2026-09-10).
  if (order.status === "SCHEDULED") {
    const resolved = resolveOrderEffectiveInterval(order);
    return {
      ...base,
      kind: "SCHEDULED",
      // Walk-in захиалга тодорхой цаггүй байж болно (scheduledAt NULL) —
      // мэдэгдэж буй хамгийн эрт баримт болох createdAt-руу унана.
      startAt: resolved.start ?? order.createdAt,
      endAt: resolved.invalid ? null : resolved.end,
      closedAt: null,
    };
  }

  // IN_PROGRESS, POSTPONED, COMPLETED, CANCELLED — бүгд нэг л ACTIVE
  // booking-оор төлөөлүүлнэ (эхэлсэн/эхлээгүй хугацаанаас хамааран).
  const startAt = order.startedAt ?? order.scheduledAt ?? order.createdAt;
  const endAt = order.completedAt ?? order.expectedFinishAt ?? null;

  const terminal = order.status === "COMPLETED" || order.status === "CANCELLED";
  const closedAt = terminal
    ? (order.completedAt ?? order.updatedAt)
    : order.occupiesCapacity === false
      ? order.updatedAt // ойролцоолол: яг сулласан мөчийг мэдэхгүй тул сүүлд өөрчлөгдсөн үеэр орлуулна
      : null;

  return { ...base, kind: "ACTIVE", startAt, endAt, closedAt };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  // Бүх tenant дундуур bulk insert хийдэг скрипт тул RLS-г тойрч гарна.
  setBypassContext();

  const orders = await prisma.serviceOrder.findMany({
    where: { timeBookings: { none: {} } },
    select: {
      id: true,
      tenantId: true,
      branchId: true,
      status: true,
      scheduledAt: true,
      startedAt: true,
      estimatedDurationMinutes: true,
      expectedFinishAt: true,
      occupiesCapacity: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (orders.length === 0) {
    console.log("✔ Booking үүсгэх шаардлагатай захиалга алга.");
    return;
  }

  const planned = orders.map(planBooking);
  const byKind = { SCHEDULED: 0, ACTIVE: 0 };
  for (const p of planned) byKind[p.kind] += 1;

  console.log(`Нийт захиалга: ${orders.length}`);
  console.log(`  SCHEDULED booking: ${byKind.SCHEDULED}`);
  console.log(`  ACTIVE booking: ${byKind.ACTIVE}`);

  if (dryRun) {
    console.log("\n--dry-run тул өөрчлөлт хийгдээгүй. Эхний 10 жишээ:");
    for (const p of planned.slice(0, 10)) {
      console.log(
        `  - order ${p.orderId}: kind=${p.kind} startAt=${p.startAt.toISOString()} endAt=${p.endAt?.toISOString() ?? "—"} closedAt=${p.closedAt?.toISOString() ?? "—"}`,
      );
    }
    return;
  }

  const data: Prisma.OrderTimeBookingCreateManyInput[] = planned.map((p) => ({
    orderId: p.orderId,
    tenantId: p.tenantId,
    branchId: p.branchId,
    kind: p.kind,
    startAt: p.startAt,
    endAt: p.endAt,
    closedAt: p.closedAt,
    // createdById: null — түүхэн backfill, тодорхой ажилтантай холбогдоогүй.
    // createdAt-г захиалгын үүссэн огноотой тааруулж, он-цагийн дараалал зөрөхгүй.
    createdAt: orders.find((o) => o.id === p.orderId)!.createdAt,
  }));

  const result = await prisma.orderTimeBooking.createMany({ data });
  console.log(`✔ ${result.count} OrderTimeBooking мөр үүсгэлээ.`);
}

main()
  .catch((err) => {
    console.error("Алдаа:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
