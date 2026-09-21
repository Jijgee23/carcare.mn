/**
 * ЗӨВХӨН УНШИНА. Энэ скрипт юу ч БИЧИХГҮЙ — тоолж, хэвлээд гарна.
 * (`scripts/backfill-booking-end.ts`-ийн эсрэг: тэр нь засдаг.)
 *
 * `backfill-booking-end.ts` нөхөхөөс ӨМНӨ "яагаад дутуу вэ"-г ялгаж харахад
 * зориулав — тэр скрипт бүх мөрийг нөхдөг тул шалтгааныг нь дараа нь мэдэх
 * боломжгүй болно. Хоёр бүлгийг нэрлэн гаргана:
 *
 * ⚠ `createdById` хоосон байгаа нь ГАРАЛТЫН нотолгоо БИШ: `createdBy`
 *   холбоос `onDelete: SetNull` тул уг мөрийг үүсгэсэн ажилтныг устгахад ч
 *   хоосон болно. Зөвхөн бусад талбартай хамт үзэж дүгнэ.
 *
 * 1. НЭЭЛТТЭЙ `ACTIVE` мөр `endAt`-гүй. Энэ нь хамгийн чухал нь: ийм мөрийг
 *    `resolveOrderIntervals` "төгсгөлийн баримт алга" гэж үзэх ба ACTIVE
 *    (scheduled биш) мөрөнд slot-урттай нөхөх fallback БАЙХГҮЙ тул
 *    `buildBranchSchedule` ба `resolveTakenCapacityIntervals` хоёул уг ажлыг
 *    ӨДРИЙН ЭЦЭС ХҮРТЭЛ ажлын байр эзэлж байна гэж тооцно. `slotCapacity: 1`
 *    салбарт энэ нь тухайн өдрийн үлдсэн бүх цагийг хаана.
 *
 *    Хоёр тайлбар байж болох ба тэдгээр нь ТЭС ӨӨР дүгнэлттэй:
 *      - Захиалгын скаляр `expectedFinishAt` УТГАТАЙ атлаа booking мөрийн
 *        `endAt` хоосон → dual-write цоорхой, өөрөөр хэлбэл яг сая зассан
 *        алдааны өөр нэг тохиолдол. КОДЫН алдаа.
 *      - Скаляр нь ч хоосон → захиалга үнэхээр таамаг хугацаагүй (backfill-ээс
 *        ирсэн, эсвэл `/api/v1/orders/[id]`-ээр орсон). АЖИЛТНЫ үйлдэл.
 *    Мөр бүрийн ард аль нь болохыг бичнэ.
 *
 * 2. ХААГДСАН мөр `endAt`-гүй. `closeOpenOrderTimeBooking` хаахдаа `endAt`-ыг
 *    үргэлж бичдэг тул эдгээр нь түүнээс гараагүй. Таамаг:
 *    `scripts/backfill-order-time-booking.ts`-ийн терминал салаа
 *    (`endAt = completedAt ?? expectedFinishAt ?? null`) — цуцлагдсан эсвэл
 *    сулласан, дуусах цаггүй байсан захиалга. Хүчин чадалд нөлөөлөхгүй;
 *    зөвхөн түүхийн асуулгад (`resolveHistoricalOrderSessions`, `endAt ?? now`)
 *    өнөөдөр хүртэл сунана.
 *
 * Ажиллуулах:
 *   npx tsx scripts/diagnose-booking-end-gaps.ts
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";

const iso = (d: Date | null | undefined) => (d ? d.toISOString().replace(".000Z", "Z") : "—");

const ROW_SELECT = {
  id: true,
  kind: true,
  startAt: true,
  endAt: true,
  closedAt: true,
  createdAt: true,
  createdById: true,
  originalDurationMinutes: true,
  branch: { select: { name: true } },
  order: {
    select: {
      number: true,
      status: true,
      startedAt: true,
      scheduledAt: true,
      completedAt: true,
      expectedFinishAt: true,
      estimatedDurationMinutes: true,
      occupiesCapacity: true,
    },
  },
} as const;

async function main() {
  // Бүх tenant дундуур уншина.
  setBypassContext();
  console.log("ЗӨВХӨН УНШИНА — энэ скрипт юу ч бичихгүй.\n");

  const activeOpen = await prisma.orderTimeBooking.findMany({
    where: { kind: "ACTIVE", closedAt: null, endAt: null },
    select: ROW_SELECT,
    orderBy: { startAt: "asc" },
  });

  console.log(`=== 1. Нээлттэй ACTIVE мөр, endAt хоосон: ${activeOpen.length} ===`);
  if (activeOpen.length === 0) {
    console.log("  (алга)");
  }
  let dualWriteGaps = 0;
  for (const row of activeOpen) {
    const o = row.order;
    // Энэ л ялгаварлах шалгуур: скаляр дээр таамаг дуусах цаг байгаа эсэх.
    const gap = o.expectedFinishAt != null;
    if (gap) dualWriteGaps += 1;
    console.log(
      `\n  #${o.number} · ${o.status} · ${row.branch.name}` +
        `\n    booking:  startAt=${iso(row.startAt)} endAt=—  (үүссэн ${iso(row.createdAt)}` +
        `, createdById=${row.createdById ?? "— (устгасан ажилтан ч байж болно)"})` +
        `\n    order:    startedAt=${iso(o.startedAt)} expectedFinishAt=${iso(o.expectedFinishAt)}` +
        ` estimate=${o.estimatedDurationMinutes ?? "—"} мин occupiesCapacity=${o.occupiesCapacity ?? "null"}` +
        `\n    → ${
          gap
            ? "DUAL-WRITE ЦООРХОЙ — скаляр дээр дуусах цаг байгаа атлаа booking мөрөнд алга. КОДЫН алдаа, зас."
            : "ТААМАГ ХУГАЦААГҮЙ — скаляр нь ч хоосон. Ажилтан дуусах хугацааг оруулах ёстой."
        }`,
    );
  }

  const closedNoEnd = await prisma.orderTimeBooking.findMany({
    where: { closedAt: { not: null }, endAt: null },
    select: ROW_SELECT,
    orderBy: { startAt: "asc" },
  });

  console.log(`\n\n=== 2. Хаагдсан мөр, endAt хоосон: ${closedNoEnd.length} ===`);
  if (closedNoEnd.length === 0) {
    console.log("  (алга)");
  }
  let backfillShaped = 0;
  for (const row of closedNoEnd) {
    const o = row.order;
    // backfill-ийн терминал салаа яг ийм мөр үлдээнэ: completedAt ч,
    // expectedFinishAt ч байхгүй тул endAt null, closedAt нь updatedAt.
    // `createdById`-г шалгуурт ОРУУЛАХГҮЙ — дээрх тайлбарыг үз.
    const looksBackfilled = o.completedAt == null && o.expectedFinishAt == null;
    if (looksBackfilled) backfillShaped += 1;
    console.log(
      `\n  #${o.number} · ${o.status} · ${row.branch.name} · kind=${row.kind}` +
        `\n    booking:  startAt=${iso(row.startAt)} closedAt=${iso(row.closedAt)} endAt=—` +
        ` createdById=${row.createdById ?? "—"}` +
        `\n    order:    completedAt=${iso(o.completedAt)} expectedFinishAt=${iso(o.expectedFinishAt)}` +
        ` occupiesCapacity=${o.occupiesCapacity ?? "null"}` +
        `\n    → ${
          looksBackfilled
            ? "BACKFILL-ИЙН ҮЛДЭГДЭЛ хэлбэртэй — хүчин чадалд нөлөөгүй, зөвхөн түүхэнд."
            : "ТААРАХГҮЙ — closeOpenOrderTimeBooking endAt-ыг үргэлж бичдэг тул энэ өөр гаралтай. Шалга."
        }`,
    );
  }

  console.log("\n\n=== Дүгнэлт ===");
  console.log(
    `  ACTIVE, endAt хоосон: ${activeOpen.length} — үүнээс dual-write цоорхой: ${dualWriteGaps}, ` +
      `таамаг хугацаагүй: ${activeOpen.length - dualWriteGaps}`,
  );
  console.log(
    `  Хаагдсан, endAt хоосон: ${closedNoEnd.length} — үүнээс backfill хэлбэртэй: ${backfillShaped}, ` +
      `тайлбаргүй: ${closedNoEnd.length - backfillShaped}`,
  );
  if (dualWriteGaps > 0) {
    console.log(
      `\n⚠ ${dualWriteGaps} мөр дээр КОДЫН алдаа сэжиглэгдэж байна — аль бичих зам ` +
        `expectedFinishAt-ыг booking мөрөнд хүргэлгүй орхисныг олох шаардлагатай.`,
    );
  }
}

main()
  .catch((err) => {
    console.error("Алдаа:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
