import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma as PrismaTypes } from "@/app/generated/prisma/client";
import { env } from "@/lib/env";
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
  bookingBaseClient?: PrismaClient;
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
  if (env.DATABASE_POOL_MAX) return env.DATABASE_POOL_MAX;
  return process.env.VERCEL ? 1 : 10;
}

/**
 * Сул холболтыг хэдий хугацааны дараа хаах вэ. Serverless (Vercel) дээр
 * хурдан суллах нь чухал (instance хэзээ ч устаж болно). Харин урт амьдрах
 * сервер (VPS / PM2) дээр pool аль хэдийн `poolMax()`-аар (жижиг, тогтмол)
 * хязгаарлагдсан тул сул зогсолтын дараа холболтыг хаах шаардлагагүй — хаавал
 * дараагийн урсгал ирэхэд шинэ холболтуудыг зэрэг нээх шаардлагатай болж,
 * яг тэр мөчид pg-ийн "client already executing a query" race дахин
 * гарч ирдэг (warm-up-ийн зайлсхийхийг оролддог тохиолдол).
 */
function idleTimeoutMillis(): number {
  return process.env.VERCEL ? 10_000 : 0;
}

function createBaseClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: env.DATABASE_URL,
      max: poolMax(),
      idleTimeoutMillis: idleTimeoutMillis(),
      connectionTimeoutMillis: 10_000,
    }),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });
}

const baseClient = globalForPrisma.prisma ? undefined : createBaseClient();
export const prisma = globalForPrisma.prisma ?? withTenantContext(baseClient!);

/** One real connection for reservation lock/read/write, preserving request RLS. */
export async function withBookingTransaction<T>(
  tenantId: string,
  work: (tx: PrismaTypes.TransactionClient) => Promise<T>,
): Promise<T> {
  const ctx = getTenantContext();
  if (!ctx || (ctx.mode === "tenant" && ctx.tenantId !== tenantId)) {
    throw new Error("Reservation tenant context mismatch");
  }
  const client = globalForPrisma.bookingBaseClient ?? baseClient ?? createBaseClient();
  globalForPrisma.bookingBaseClient = client;
  return client.$transaction(async (tx) => {
    // Explicitly set both transaction-local flags; never inherit pool state.
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true), set_config('app.bypass_rls', ${ctx.mode === "bypass" ? "on" : "off"}, true)`;
    return work(tx);
  }, { isolationLevel: "ReadCommitted", maxWait: 10_000, timeout: 15_000 });
}

/**
 * Pool-ыг тэр даруй бүрэн дүүргэнэ (`poolMax()` тооны холболт үүсгэнэ) — эхний
 * бодит хүсэлтүүд ирэхэд ШИНЭ холболт зэрэг үүсгэх (cold start) хийхгүй
 * байхын тулд. Бодит production-д (PM2 restart-ийн дараах эхний давалгаа)
 * зэрэгцээ шинэ холболт үүсгэх мөч дээр `pg`-ийн "client already executing a
 * query" race ажиглагдсан — pool аль хэдийн дүүрсэн үед энэ цонх бүхэлдээ
 * алга болно. RLS extension-ийг тойрч (context шаардахгүй) суурь client дээр
 * шууд ажиллуулна.
 *
 * `instrumentation.ts`-ийн `register()`-ээс `await`-тэйгээр дуудагдана —
 * Next.js сервер бодит хүсэлт хүлээж авахаас ӨМНӨ (fire-and-forget биш,
 * блоклож) дуусгахын тулд: өмнө нь module-load дээр `void (async...`-аар
 * дэвсгэрт ажиллуулдаг байсан ч, warm-up дуусахаас өмнө ирсэн бодит хүсэлт
 * яг тэр л race-ийг дахин үүсгэх боломжтой байсан.
 *
 * `next build`-ийн static generation worker-үүдэд (`NEXT_PHASE=
 * phase-production-build`) дуудагдахгүй — эдгээр нь module-ыг хэд хэдэн
 * тусдаа process дотор зэрэг ачаалж, warm-up зэрэгцэн Postgres-ийн
 * max_connections-г шавхаж static export-ийг эвдэж байсныг олсон.
 */
export async function warmPool(): Promise<void> {
  if (!baseClient || process.env.NEXT_PHASE === "phase-production-build") return;
  // Дараалуулж (Promise.all-аар зэрэг биш) явуулна: `baseClient.$queryRaw` бүр
  // адаптерын нэг pg Pool-оос холболт авахыг оролддог тул поол бүрэн дүүрээгүй
  // үед нэг зэрэг олон дуудлага "client already executing a query" (pg-ийн
  // deprecation warning) үүсгэдэг байсан.
  for (let i = 0; i < poolMax(); i++) {
    await baseClient.$queryRaw`SELECT 1`.catch(() => {});
  }
}

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
