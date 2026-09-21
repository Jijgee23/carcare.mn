/**
 * НЭЭЛТТЭЙ (`closedAt: null`) `OrderTimeBooking` мөрийн дутуу `endAt`-ыг нөхнө —
 * хуучин, талбар нь дутуу өгөгдлийг цэвэрлэх нэг удаагийн скрипт.
 *
 * ## Яагаад ЗӨВХӨН нээлттэй мөр вэ
 *
 * Зөвхөн нээлттэй мөр л сул цагийн тооцоололд нөлөөлдөг. Хаагдсан мөр хоёр
 * шалгуураар хасагддаг: `resolveTakenCapacityIntervals` ба `fetchOrderRows`
 * хоёул захиалгыг зөвхөн `SCHEDULED`/`IN_PROGRESS` статусаар, эсвэл НЭЭЛТТЭЙ
 * booking-той эсэхээр (`closedAt: null`) авдаг. Тиймээс цуцлагдсан захиалгын
 * хаагдсан мөр `endAt`-гүй ч сул цагийг ХӨНДӨХГҮЙ (шалгасан). Тэр нь зөвхөн
 * `loadBranchScheduleHistory` (түүхийн харагдац) дээр л харагдана. Өгөгдлийг
 * шаардлагагүй газар өөрчлөхгүй байх үүднээс хамрах хүрээнээс гаргав.
 *
 * ## Юуг нөхөж байгаа нь яагаад чухал вэ
 *
 * Нээлттэй мөрийн `endAt: null`-ыг `resolveOrderIntervals` "төгсгөлийн баримт
 * алга" гэж уншина:
 *   - `SCHEDULED` бол салбарын НЭГ слот хүртэл богиносгож, `uncertain` болно;
 *   - `ACTIVE` бол slot-урттай fallback БАЙХГҮЙ тул уг ажил асуусан ӨДӨР
 *     БҮРИЙН эцэс хүртэл ажлын байр эзэлнэ — хугацааны хязгааргүй. 6-р сард
 *     эхэлж дуусгаагүй `IN_PROGRESS` захиалга 12-р сарын өдрийг ч бүтнээр нь
 *     эзэлсээр байна, `slotCapacity: 1` салбарт тэр салбар БҮРМӨСӨН
 *     захиалга авахаа болино.
 *
 * Энэ скрипт тэр төгсгөлийг нөхөж эзэмшлийг хязгаарлана. Жинхэнэ шийдэл нь
 * тэдгээр захиалгыг дуусгах/цуцлах явдал — энэ бол зөвхөн өгөгдлийн залруулга.
 *
 * ## Төгсгөлийг хэрхэн сонгох вэ (эрэмбээр)
 *
 *   1. `ACTIVE` + захиалгын `expectedFinishAt` нь `startAt`-аас ХОЙШ
 *      → `endAt = expectedFinishAt`. Dual-write хийсэн бол бичих байсан яг тэр
 *      утга. (`startAt`-аас өмнө бол хоцрогдсон таамаг тул алгасна.)
 *   2. Захиалгын `estimatedDurationMinutes` > 0 → `startAt + estimate`.
 *   3. Юу ч байхгүй → `startAt + Branch.slotMinutes` (?? 30). ТААМАГ — яг тэр
 *      утгыг `buildBranchSchedule` аль хэдийн харагдац дээр ашигладаг тул
 *      дүрслэл өөрчлөгдөхгүй, гэхдээ таамгийг өгөгдөл болгон бичиж байгааг
 *      санаарай.
 *
 * Сонгосон төгсгөл ЯМАРЧ тохиолдолд `MAX_BACKFILL_MINUTES`-ээс урт байж
 * болохгүй. `startAt`-аас хойш гарахгүй бол мөрийг алгасаж мэдээлнэ — буруу
 * интервал нь хоосноос дор.
 *
 * Идэмпотент: нөхсөн мөр дараагийн ажиллуулалтад таарахгүй.
 *
 * Эхлээд тоолж хараарай (өөрчлөлт хийхгүй):
 *   npx tsx scripts/backfill-booking-end.ts --dry-run
 *
 * Дараа нь бодитоор гүйцэтгэх бол:
 *   npx tsx scripts/backfill-booking-end.ts
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";
import { DEFAULT_SLOT_MINUTES } from "@/lib/appointment-slots";

/** Нөхөж буй ямарч мөрийн дээд урт (минут) — хэрэглэгчийн шийдвэр. */
const MAX_BACKFILL_MINUTES = 180;

function positiveIntegerMinutes(value: number | null): number | null {
  return value != null && Number.isInteger(value) && value > 0 ? value : null;
}

/** Аль эрэмбээр төгсгөлийг сонгосон бэ — `branch-slot` л таамаг. */
type Source = "forecast" | "estimate" | "branch-slot";

type Planned = {
  id: string;
  label: string;
  startAt: Date;
  endAt: Date;
  source: Source;
  /** `MAX_BACKFILL_MINUTES`-т таслагдсан эсэх. */
  capped: boolean;
  /** `originalDurationMinutes` нь `endAt`-аас гардаг тул хоосон бол хамт нөхнө;
   *  утгатай бол хэзээ ч дарж бичихгүй. */
  setOriginal: boolean;
  minutes: number;
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  // Бүх tenant дундуур ажилладаг засварын скрипт тул RLS-г тойрно —
  // scripts/backfill-order-time-booking.ts-тэй ижил хэв маяг.
  setBypassContext();

  const rows = await prisma.orderTimeBooking.findMany({
    // `closedAt: null` — дээрх "Яагаад ЗӨВХӨН нээлттэй мөр вэ"-г үз.
    where: { endAt: null, closedAt: null },
    select: {
      id: true,
      kind: true,
      startAt: true,
      branchId: true,
      originalDurationMinutes: true,
      order: {
        select: {
          number: true,
          status: true,
          expectedFinishAt: true,
          estimatedDurationMinutes: true,
        },
      },
    },
    orderBy: { startAt: "asc" },
  });

  // Хамрах хүрээнээс гадуурх мөрийг зөвхөн мэдээлнэ — хөндөхгүй.
  const closedNullEnd = await prisma.orderTimeBooking.count({
    where: { endAt: null, closedAt: { not: null } },
  });

  if (rows.length === 0) {
    console.log("✔ endAt хоосон, НЭЭЛТТЭЙ мөр алга.");
    if (closedNullEnd > 0) {
      console.log(
        `ℹ Хаагдсан мөр endAt-гүй: ${closedNullEnd} — сул цагт нөлөөгүй тул санаатай хөндөхгүй.`,
      );
    }
    return;
  }

  // 3-р эрэмбэд хэрэгтэй салбаруудын slot уртыг нэг удаа уншина.
  const slotMinutesByBranch = new Map<string, number>();
  const branches = await prisma.branch.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.branchId))] } },
    select: { id: true, slotMinutes: true },
  });
  for (const b of branches) {
    slotMinutesByBranch.set(
      b.id,
      b.slotMinutes && b.slotMinutes > 0 ? b.slotMinutes : DEFAULT_SLOT_MINUTES,
    );
  }

  const planned: Planned[] = [];
  const skipped: string[] = [];

  for (const row of rows) {
    const label = `#${row.order.number} · ${row.order.status} · ${row.kind}`;
    const startMs = row.startAt.getTime();
    let endAt: Date | null = null;
    let source: Source | null = null;

    // 1. ACTIVE — захиалгын таамаг дуусах цаг, зөвхөн startAt-аас хойш бол.
    if (
      row.kind === "ACTIVE" &&
      row.order.expectedFinishAt != null &&
      row.order.expectedFinishAt.getTime() > startMs
    ) {
      endAt = row.order.expectedFinishAt;
      source = "forecast";
    }

    // 2. Захиалгын тооцоолол.
    if (endAt == null) {
      const minutes = positiveIntegerMinutes(row.order.estimatedDurationMinutes);
      if (minutes != null) {
        endAt = new Date(startMs + minutes * 60000);
        source = "estimate";
      }
    }

    // 3. Салбарын slot урт — таамаг.
    if (endAt == null) {
      const minutes = slotMinutesByBranch.get(row.branchId) ?? DEFAULT_SLOT_MINUTES;
      endAt = new Date(startMs + minutes * 60000);
      source = "branch-slot";
    }

    // Төгсгөл нь startAt-аас хойш байх ЁСТОЙ — эс бөгөөс `resolveOrderIntervals`
    // мөрийг `invalid` гэж үзэх тул нөхөх нь нөхөөгүйгээс дор.
    if (endAt.getTime() <= startMs) {
      skipped.push(`${label}: тооцсон төгсгөл (${endAt.toISOString()}) нь startAt-аас хойш биш`);
      continue;
    }

    const capMs = startMs + MAX_BACKFILL_MINUTES * 60000;
    const capped = endAt.getTime() > capMs;
    if (capped) endAt = new Date(capMs);

    planned.push({
      id: row.id,
      label,
      startAt: row.startAt,
      endAt,
      source: source!,
      capped,
      setOriginal: row.originalDurationMinutes == null,
      minutes: Math.round((endAt.getTime() - startMs) / 60000),
    });
  }

  const bySource = (s: Source) => planned.filter((p) => p.source === s).length;
  console.log(`Нээлттэй, endAt хоосон мөр: ${rows.length}`);
  console.log(`  1. forecast    (expectedFinishAt-аар): ${bySource("forecast")}`);
  console.log(`  2. estimate    (startAt + тооцоолол):  ${bySource("estimate")}`);
  console.log(`  3. branch-slot (ТААМАГ, slot урт):     ${bySource("branch-slot")}`);
  const cappedCount = planned.filter((p) => p.capped).length;
  if (cappedCount > 0) {
    console.log(
      `\n  ${cappedCount} мөрийн төгсгөл ${MAX_BACKFILL_MINUTES} минутын дээд хязгаарт таслагдав.`,
    );
  }
  if (closedNullEnd > 0) {
    console.log(
      `\nℹ Хамрах хүрээнээс гадуур — хаагдсан мөр endAt-гүй: ${closedNullEnd}. ` +
        `Сул цагийн тооцоололд оролцдоггүй тул санаатай хөндөхгүй ` +
        `(зөвхөн loadBranchScheduleHistory дээр харагдана).`,
    );
  }
  if (skipped.length > 0) {
    console.log(`\n⚠ Алгассан ${skipped.length} мөр:`);
    for (const s of skipped) console.log(`  - ${s}`);
  }

  if (planned.length === 0) {
    console.log("\n✔ Нөхөх мөр алга.");
    return;
  }

  if (dryRun) {
    console.log("\n--dry-run тул өөрчлөлт хийгдээгүй. Төлөвлөгөө:");
    for (const p of planned) {
      console.log(
        `  - ${p.label}: ${p.startAt.toISOString()} → ${p.endAt.toISOString()} ` +
          `(${p.minutes} мин, ${p.source}${p.capped ? ", capped" : ""})`,
      );
    }
    return;
  }

  let updated = 0;
  for (const p of planned) {
    // Мөр бүрийг өөрийнх нь утгаар шинэчилнэ (нэг updateMany-д багтахгүй).
    // Уралдаанаас сэргийлж нөхцөлийг дахин шалгана: энэ хооронд өөр зам
    // (дахин товлолт, ажил эхлэх/дуусах) уг мөрийг хөдөлгөсөн бол хүрэхгүй.
    const result = await prisma.orderTimeBooking.updateMany({
      where: { id: p.id, endAt: null, closedAt: null },
      data: {
        endAt: p.endAt,
        ...(p.setOriginal ? { originalDurationMinutes: p.minutes } : {}),
      },
    });
    updated += result.count;
  }

  console.log(
    `\n✔ ${updated} мөр нөхөгдлөө ` +
      `(${planned.length - updated} мөрийг энэ хооронд өөр зам өөрчилсөн тул алгаслаа).`,
  );
}

main()
  .catch((err) => {
    console.error("Алдаа:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
