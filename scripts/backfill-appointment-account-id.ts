/**
 * `registerAppointmentByStaff` эрт хувилбарт customer.accountId-г
 * Appointment.accountId руу дамжуулдаггүй байсан тул, тухайн үед ажилтны
 * утсаар үүсгэсэн боловч тухайн үйлчлүүлэгч аль хэдийн онлайн Account-той
 * байсан цаг захиалгууд гүүрлэгдээгүй үлдсэн (харагдахгүй "Миний цагууд"-д).
 * Энэ нэг удаагийн скрипт тэдгээрийг гар аргаар засварлана.
 *
 * Логик: Appointment.accountId IS NULL, харин Appointment.customerId-тэй
 * холбогдсон Customer.accountId IS NOT NULL бол → Appointment.accountId-г
 * тухайн Customer.accountId-оор дүүргэнэ.
 *
 * Эхлээд тоолж хараарай (dry-run, өөрчлөлт хийхгүй):
 *   npx tsx scripts/backfill-appointment-account-id.ts --dry-run
 *
 * Дараа нь бодитоор гүйцэтгэх бол:
 *   npx tsx scripts/backfill-appointment-account-id.ts
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  // Бүх tenant дундуур bulk update хийдэг скрипт тул RLS-г тойрч гарна.
  setBypassContext();

  const affected = await prisma.appointment.findMany({
    where: {
      accountId: null,
      customerId: { not: null },
      customer: { accountId: { not: null } },
    },
    select: {
      id: true,
      tenantId: true,
      customerId: true,
      customer: { select: { accountId: true } },
    },
  });

  if (affected.length === 0) {
    console.log("✔ Засах цаг захиалга алга.");
    return;
  }

  console.log(`Олдсон: ${affected.length} цаг захиалга.`);
  for (const a of affected) {
    console.log(`  - ${a.id} (tenant ${a.tenantId}) → accountId=${a.customer!.accountId}`);
  }

  if (dryRun) {
    console.log("\n--dry-run тул өөрчлөлт хийгдээгүй.");
    return;
  }

  let updated = 0;
  for (const a of affected) {
    await prisma.appointment.update({
      where: { id: a.id },
      data: { accountId: a.customer!.accountId },
    });
    updated += 1;
  }
  console.log(`✔ ${updated} цаг захиалгыг холбогдох Account-тай гүүрлэлээ.`);
}

main()
  .catch((err) => {
    console.error("Алдаа:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
