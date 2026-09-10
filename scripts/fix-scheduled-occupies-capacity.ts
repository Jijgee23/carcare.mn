/**
 * findScheduleConflict (app/_actions/orders.ts) хуучин логикоороо SCHEDULED
 * (хараахан эхлээгүй) захиалгын occupiesCapacity=true үед startedAt (NULL)
 * руу шилждэг байсан тул давхцлын шалгалтаас чимээгүй унадаг байсан —
 * ямар ч анхааруулгагүй "давхцалгүй" мэт харагдана. Логикийг засварласан ч
 * (occupiesCapacity нь зөвхөн бүрэн хасах эсэхийг шийднэ, аль timestamp
 * ашиглахыг биш) энэ хамааралгүй болсон утгыг байгаа мөрүүдээс цэвэрлэнэ:
 * SCHEDULED статустай захиалгад occupiesCapacity утга нь семантик ач
 * холбогдолгүй тул NULL болгож, шинээр үүсгэсэн захиалгуудтай ижил
 * (анхны, "тодорхойлогдоогүй") төлөвт оруулна.
 *
 * Эхлээд тоолж хараарай (dry-run, өөрчлөлт хийхгүй):
 *   npx tsx scripts/fix-scheduled-occupies-capacity.ts --dry-run
 *
 * Дараа нь бодитоор гүйцэтгэх бол:
 *   npx tsx scripts/fix-scheduled-occupies-capacity.ts
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  // Бүх tenant дундуур bulk update хийдэг скрипт тул RLS-г тойрч гарна.
  setBypassContext();

  const affected = await prisma.serviceOrder.findMany({
    where: {
      status: "SCHEDULED",
      occupiesCapacity: true,
    },
    select: {
      id: true,
      number: true,
      tenantId: true,
      branchId: true,
      scheduledAt: true,
    },
  });

  if (affected.length === 0) {
    console.log("✔ Занаастай (SCHEDULED + occupiesCapacity=true) захиалга алга.");
    return;
  }

  console.log(`Олдсон: ${affected.length} захиалга.`);
  for (const o of affected) {
    console.log(
      `  - #${o.number} (${o.id}, tenant ${o.tenantId}, salbar ${o.branchId}) scheduledAt=${o.scheduledAt?.toISOString()}`,
    );
  }

  if (dryRun) {
    console.log("\n--dry-run тул өөрчлөлт хийгдээгүй.");
    return;
  }

  const result = await prisma.serviceOrder.updateMany({
    where: { id: { in: affected.map((o) => o.id) } },
    data: { occupiesCapacity: null },
  });
  console.log(`✔ ${result.count} захиалгын occupiesCapacity-г NULL болголоо.`);
}

main()
  .catch((err) => {
    console.error("Алдаа:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
