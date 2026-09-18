/**
 * D-068 залруулга: `createOrderAction` (app/_actions/orders.ts) нээлттэй
 * SCHEDULED `OrderTimeBooking` мөрийг ҮРГЭЛЖ `endAt: null`-тэй үүсгэдэг
 * байсан — захиалгын `estimatedDurationMinutes` (цаг захиалгын сонгосон
 * ангиллуудын нийлбэр) тухайн мөрөнд хэзээ ч бичигддэггүй байв.
 *
 * D-068 step 3-ын read-path swap-ийн дараа `resolveOrderIntervals` энэ мөрийг
 * ServiceOrder-ийн скаляраас ИЛҮҮД үзэх тул `endAt: null` нь "төгсгөлийн
 * баримт алга" гэсэн утгатай болж:
 *   - `buildBranchSchedule` → `missing-estimate`, блокийг салбарын НЭГ слот
 *     (жишээ нь 30 мин) болгон богиносгож, `uncertain` гэж тэмдэглэнэ;
 *   - `resolveTakenCapacityIntervals` → нийтийн сул цагийн шалгалтад мөн
 *     ганц слот л эзэлнэ (150 минутын ажил 30 минут л хаана).
 *
 * Дахин товлох бүх зам (`updateOrderAction`, `rescheduleOrderAction`,
 * `lib/linked-reschedule.ts`) болон `scripts/backfill-order-time-booking.ts`
 * энэ төгсгөлийг үргэлж ЗӨВ бодож бичдэг байсан — зөвхөн үүсгэх зам л
 * орхигдсон. Тиймээс backfill-ийн дараа үүссэн захиалгууд л гэмтэлтэй.
 *
 * Энэ скрипт яг тэр мөрүүдийг олж (нээлттэй + SCHEDULED + `endAt` null +
 * захиалга нь бодит тооцоололтой) `startAt + estimatedDurationMinutes`-аар
 * нөхнө. Идэмпотент: залруулсан мөр дараагийн ажиллуулалтад таарахгүй.
 * Тооцоологүй захиалгын мөрийг (`estimatedDurationMinutes` null) ГАРГАХГҮЙ —
 * тэнд "төгсгөл мэдэгдэхгүй" гэдэг нь бодит үнэн.
 *
 * Эхлээд тоолж хараарай (өөрчлөлт хийхгүй):
 *   npx tsx scripts/repair-scheduled-booking-end.ts --dry-run
 *
 * Дараа нь бодитоор гүйцэтгэх бол:
 *   npx tsx scripts/repair-scheduled-booking-end.ts
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";

function positiveIntegerMinutes(value: number | null): number | null {
  return value != null && Number.isInteger(value) && value > 0 ? value : null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  // Бүх tenant дундуур ажилладаг засварын скрипт тул RLS-г тойрно —
  // scripts/backfill-order-time-booking.ts-тэй ижил хэв маяг.
  setBypassContext();

  const rows = await prisma.orderTimeBooking.findMany({
    where: {
      kind: "SCHEDULED",
      closedAt: null,
      endAt: null,
      order: { estimatedDurationMinutes: { not: null } },
    },
    select: {
      id: true,
      startAt: true,
      originalDurationMinutes: true,
      order: {
        select: { id: true, number: true, status: true, estimatedDurationMinutes: true },
      },
    },
    orderBy: { startAt: "asc" },
  });

  const planned = rows
    .map((row) => {
      const minutes = positiveIntegerMinutes(row.order.estimatedDurationMinutes);
      if (minutes == null) return null;
      return {
        id: row.id,
        orderNumber: row.order.number,
        orderStatus: row.order.status,
        startAt: row.startAt,
        minutes,
        endAt: new Date(row.startAt.getTime() + minutes * 60000),
        // openOrderTimeBooking энэ талбарыг endAt-аас гаргадаг тул зөв
        // үүссэн мөр дээр байх ёстой утгыг нөхнө. Аль хэдийн утгатай бол
        // (хожим гараар товлолт өөрчлөгдсөн) хэзээ ч дарж бичихгүй.
        setOriginal: row.originalDurationMinutes == null,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  if (planned.length === 0) {
    console.log("✔ Засах шаардлагатай SCHEDULED booking мөр алга.");
    return;
  }

  console.log(`Засах мөр: ${planned.length}`);
  if (dryRun) {
    console.log("\n--dry-run тул өөрчлөлт хийгдээгүй. Эхний 20 жишээ:");
    for (const p of planned.slice(0, 20)) {
      console.log(
        `  - #${p.orderNumber} (${p.orderStatus}): ${p.startAt.toISOString()} → ${p.endAt.toISOString()} (${p.minutes} мин)`,
      );
    }
    return;
  }

  let updated = 0;
  for (const p of planned) {
    // Мөр бүрийг өөрийнх нь тооцсон төгсгөлөөр шинэчилнэ — нэг updateMany-д
    // багтахгүй (утга мөр тус бүрд өөр). Уралдаанаас сэргийлж `endAt: null`
    // нөхцөлийг дахин шалгана: энэ хооронд өөр зам (дахин товлолт, ажил
    // эхлэх) уг мөрийг хөдөлгөсөн бол хүрэхгүй.
    const result = await prisma.orderTimeBooking.updateMany({
      where: { id: p.id, kind: "SCHEDULED", closedAt: null, endAt: null },
      data: {
        endAt: p.endAt,
        ...(p.setOriginal ? { originalDurationMinutes: p.minutes } : {}),
      },
    });
    updated += result.count;
  }

  console.log(`✔ ${updated} мөр засагдлаа (${planned.length - updated} мөрийг энэ хооронд өөр зам өөрчилсөн тул алгаслаа).`);
}

main()
  .catch((err) => {
    console.error("Алдаа:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
