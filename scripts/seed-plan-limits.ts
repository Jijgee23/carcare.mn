/**
 * Plan limit бичлэгүүдийг seed хийх CLI script.
 * Идэвхтэй limit байгаа бол `update` хийнэ, байхгүй бол `create` (upsert).
 *
 * Ажиллуулах:
 *   npx tsx scripts/seed-plan-limits.ts
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import {
  ALL_LIMIT_CODES,
  DEFAULT_PLAN_LIMITS,
  PLAN_LIMIT_META,
  type PlanLimitCode,
} from "../lib/plan-limits";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL орчны хувьсагч тохируулагдаагүй.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

const PLANS = ["FREE", "BUSINESS", "ENTERPRISE"] as const;

async function main() {
  let created = 0;
  let kept = 0;

  for (const plan of PLANS) {
    for (const code of ALL_LIMIT_CODES as PlanLimitCode[]) {
      const meta = PLAN_LIMIT_META[code];
      const def = DEFAULT_PLAN_LIMITS[plan][code];

      // Идэвхтэй бичлэг байгаа эсэхийг шалгана (SuperAdmin-н өөрчилсөн утгыг
      // дарахгүйн тулд).
      const existing = await prisma.planLimit.findUnique({
        where: { plan_code: { plan, code } },
      });
      if (existing) {
        kept++;
        continue;
      }

      await prisma.planLimit.create({
        data: {
          plan,
          code,
          label: meta.label,
          description: meta.description,
          kind: meta.kind,
          intValue: def.intValue,
          boolValue: def.boolValue,
          sortOrder: meta.sortOrder,
        },
      });
      created++;
    }
  }

  console.log(`\n✔ Plan limits seed:`);
  console.log(`  Шинээр үүсгэв:   ${created}`);
  console.log(`  Өмнө байсныг үлдээв: ${kept}`);
}

main()
  .catch((err) => {
    console.error("Алдаа:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
