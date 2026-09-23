/**
 * Монголын хаягийн лавлагаа (City → District → Khoroo)-г scripts/mongolian.sql-аас
 * DB-д ачаална. Прод-д аюулгүй: tenant дата, fixture дата огт хөндөхгүй,
 * идемпотент (skipDuplicates — байгаа id-г алгасна).
 *
 * Ажиллуулах (прод сервер дээр):
 *   cd /home/ubuntu/carcare.mn && npm run db:seed:address
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";
import { formatAddressSeedResult, seedAddressData } from "../prisma/seed-address";

async function main() {
  setBypassContext();
  const result = await seedAddressData(prisma);
  console.log(formatAddressSeedResult(result));

  const [city, district, khoroo] = await Promise.all([
    prisma.city.count(),
    prisma.district.count(),
    prisma.khoroo.count(),
  ]);
  console.log(`DB-д одоо: City ${city}, District ${district}, Khoroo ${khoroo}`);
}

main()
  .catch((e) => {
    console.error("Хаягийн seed алдаа:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
