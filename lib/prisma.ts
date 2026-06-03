import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/**
 * pg pool-ийн нэгэн зэрэг холболтын дээд хязгаар.
 *
 * Serverless (Vercel) дээр instance бүр өөрийн pool нээдэг тул N instance × pool
 * нь Postgres-ийн `max_connections`-г хурдан дүүргэж "too many clients" алдаа
 * үүсгэдэг — иймд маш бага (1) байлгана. Урт амьдрах сервер (VPS / `next start`)
 * дээр нэг л pool байх тул илүү өндөр (10) тохиромжтой. `DATABASE_POOL_MAX`-аар
 * дарж тохируулж болно (ж: PgBouncer-ийн ард).
 */
function poolMax(): number {
  const raw = process.env.DATABASE_POOL_MAX;
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return process.env.VERCEL ? 1 : 10;
}

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL орчны хувьсагч тохируулагдаагүй байна. .env файлд DATABASE_URL=... нэмнэ үү.",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: url,
      max: poolMax(),
      // Сул холболтыг хурдан суллана (serverless дээр чухал).
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    }),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { Prisma } from "@/app/generated/prisma/client";
