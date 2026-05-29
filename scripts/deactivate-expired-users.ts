/**
 * Хугацаа нь дууссан ажилтнуудыг (`activeUntil <= now`) `isActive=false`
 * болгож тэмдэглэнэ. Login + requireUser хоёр өөрсдөө шалгадаг боловч
 * энэ нь жагсаалт шүүлтэд тогтвортой статус харуулахын тулд.
 *
 * Cron-оор өдөрт 1 удаа гүйцэтгэхийг зөвлөмж болгоно (UTC 00:00):
 *   0 0 * * * /usr/bin/npx tsx scripts/deactivate-expired-users.ts
 *
 * Эсвэл админ хүсэхэд гараар:
 *   npx tsx scripts/deactivate-expired-users.ts
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL орчны хувьсагч тохируулагдаагүй.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

async function main() {
  const now = new Date();
  const result = await prisma.user.updateMany({
    where: {
      isActive: true,
      activeUntil: { not: null, lte: now },
    },
    data: { isActive: false },
  });
  console.log(`✔ ${result.count} ажилтан хугацаа дууссан тул идэвхгүй боллоо.`);
}

main()
  .catch((err) => {
    console.error("Алдаа:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
