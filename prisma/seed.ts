import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";
import { formatAddressSeedResult, seedAddressData } from "./seed-address";
import { seedFixtureData } from "./fixture-seed";

/**
 * Хөгжүүлэлтийн бүрэн seed: хаягийн лавлагаа (City/District/Khoroo) +
 * тест fixture дата. Прод-д ЗӨВХӨН хаягийн seed хэрэгтэй бол
 * `npm run db:seed:address` (scripts/seed-address.ts) ашиглана.
 */
async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_FIXTURE_DATA !== "true") {
    throw new Error(
      "Fixture seed production орчинд хамгаалагдсан. Зөвхөн хаягийн лавлагаа оруулах бол `npm run db:seed:address`, fixture-г зориуд ажиллуулах бол SEED_FIXTURE_DATA=true тохируулна уу.",
    );
  }

  // Зөвхөн global reference хүснэгт (City/District/Khoroo, RLS-гүй) хөндөх
  // ч prisma extension context шаарддаг тул bypass тавина.
  setBypassContext();
  console.log(formatAddressSeedResult(await seedAddressData(prisma)));

  await seedFixtureData(prisma);
}

main()
  .catch((e) => {
    console.error("Seed алдаа:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
