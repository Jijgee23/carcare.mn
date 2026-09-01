import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";
import { getTenantContext } from "@/lib/tenant-context";

/**
 * Postgres RLS-тэй хослуулж ажиллах query extension: query бүрийн өмнө
 * (нэг transaction дотор) `app.tenant_id` эсвэл `app.bypass_rls` session
 * variable-г тавьж өгснөөр DB түвшинд tenant тусгаарлалтыг баталгаажуулна.
 * Context тохируулаагүй (requireUser/requireApiUser/setBypassContext дуудаагүй)
 * query шууд throw хийнэ — чимээгүй хоосон үр дүн буцаахгүй.
 */
function withTenantContext(client: PrismaClient) {
  return client.$extends({
    name: "tenant-context-rls",
    query: {
      async $allOperations({ model, operation, args, query }) {
        const ctx = getTenantContext();
        if (!ctx) {
          throw new Error(
            `Tenant context тохируулагдаагүй байна (${model ?? "?"}.${operation}) — requireUser()/requireApiUser()/setBypassContext() дуудсан эсэхээ шалгана уу.`,
          );
        }
        const [, result] = await client.$transaction(
          [
            ctx.mode === "bypass"
              ? client.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`
              : client.$executeRaw`SELECT set_config('app.tenant_id', ${ctx.tenantId}, true)`,
            query(args),
          ],
          // Анхдагч maxWait (2с) landing зэрэг олон компонент зэрэг prisma
          // дуудсан хуудсанд (эсвэл Turbopack dev-ийн удаан анхны compile-ийн
          // үед) хэт хатуу тул нэмэгдүүлсэн — бодит pool exhaustion биш, зөвхөн
          // slot хүлээх хугацаа.
          { maxWait: 10_000, timeout: 10_000 },
        );
        return result;
      },
    },
  });
}

type TenantScopedPrismaClient = ReturnType<typeof withTenantContext>;

const globalForPrisma = globalThis as unknown as {
  prisma?: TenantScopedPrismaClient;
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

function createBaseClient(): PrismaClient {
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

export const prisma = globalForPrisma.prisma ?? withTenantContext(createBaseClient());

/**
 * `prisma.$transaction(async (tx) => ...)` дотор өгөгддөг tx client-ийн төрөл —
 * extension-той client-ээс гаргаж авсан тул `logAudit` зэрэг "tx-ийг сонголтоор
 * авдаг" helper функцүүдэд ашиглана (base `Prisma.TransactionClient` extension-той
 * client-тэй нийцэхгүй болсон тул үүнийг оронд нь хэрэглэнэ).
 */
export type PrismaTransactionClient = Parameters<
  Parameters<(typeof prisma)["$transaction"]>[0]
>[0];

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { Prisma } from "@/app/generated/prisma/client";
