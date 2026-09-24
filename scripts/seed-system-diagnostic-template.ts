/**
 * "Ерөнхий үзлэг (хүлээж авах)" оношилгооны загварыг СИСТЕМИЙН хуваалцсан
 * загвар (tenantId = NULL, /system/diagnostic-templates) болгон seed хийнэ.
 * Агуулга нь `lib/diagnostics.ts`-ийн DEFAULT_INTAKE_TEMPLATE_SCHEMA — signup
 * дээр тенант бүрт үүсдэг `isSystemDefault` хуулбартай ижил.
 *
 * Идемпотент, прод-д аюулгүй:
 *   - Тогтмол id (`SYSTEM_TEMPLATE_ID`)-аар шалгана; байгаа бол анхдагчаар
 *     хөндөхгүй (super admin засварласныг дарахгүй).
 *   - Ижил нэртэй системийн загвар өөр id-тай байвал давхар үүсгэхгүй.
 *   - Тенантын дата хөндөхгүй; grant зөвхөн flag өгсөн үед.
 *
 * Ажиллуулах (прод сервер дээр):
 *   cd /home/ubuntu/carcare.mn && npm run db:seed:diagnostic-template
 *
 * Flag:
 *   --update           Байгаа загварын нэр/төрөл/schema-г кодын утгаар шинэчилнэ
 *                      (тайлантай бөгөөд schema өөрчлөгдсөн бол version +1).
 *   --grant-all        Бүх байгууллагад ашиглах эрх олгоно.
 *   --grant=id1,id2    Зөвхөн заасан байгууллагуудад эрх олгоно.
 *
 * npm-ээр flag дамжуулахдаа `--` хэрэгтэй:
 *   npm run db:seed:diagnostic-template -- --grant-all
 */

import "dotenv/config";
import { Prisma } from "@/app/generated/prisma/client";
import {
  DEFAULT_INTAKE_TEMPLATE_NAME,
  DEFAULT_INTAKE_TEMPLATE_SCHEMA,
} from "@/lib/diagnostics";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";

const SYSTEM_TEMPLATE_ID = "systpl_default_intake";

// jsonb object key-ийн дарааллыг өөрчилдөг тул дарааллаас үл хамааран харьцуулна.
function sameJson(a: unknown, b: unknown): boolean {
  const sortKeys = (_k: string, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)))
      : v;
  return JSON.stringify(a, sortKeys) === JSON.stringify(b, sortKeys);
}

const args = process.argv.slice(2);
const update = args.includes("--update");
const grantAll = args.includes("--grant-all");
const grantIds = (args.find((a) => a.startsWith("--grant="))?.slice("--grant=".length) ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function upsertTemplate(): Promise<string> {
  const existing = await prisma.diagnosticTemplate.findUnique({
    where: { id: SYSTEM_TEMPLATE_ID },
    select: { tenantId: true, schema: true, version: true, _count: { select: { reports: true } } },
  });

  if (existing) {
    if (existing.tenantId !== null) {
      throw new Error(`${SYSTEM_TEMPLATE_ID} id-тай мөр тенантад харьяалагдаж байна — зогсоов.`);
    }
    if (!update) {
      console.log(`= Загвар аль хэдийн байна (${SYSTEM_TEMPLATE_ID}) — хөндсөнгүй. Шинэчлэх бол --update.`);
      return SYSTEM_TEMPLATE_ID;
    }
    const changed = !sameJson(existing.schema, DEFAULT_INTAKE_TEMPLATE_SCHEMA);
    await prisma.diagnosticTemplate.update({
      where: { id: SYSTEM_TEMPLATE_ID },
      data: {
        name: DEFAULT_INTAKE_TEMPLATE_NAME,
        type: "INTAKE",
        schema: DEFAULT_INTAKE_TEMPLATE_SCHEMA as Prisma.InputJsonValue,
        // Бөглөгдсөн тайлан хуучин schema-гаа templateVersion-оор заадаг.
        ...(changed && existing._count.reports > 0 ? { version: existing.version + 1 } : {}),
      },
    });
    console.log(`↻ Загварыг шинэчлэв (schema ${changed ? "өөрчлөгдсөн" : "ижил"}).`);
    return SYSTEM_TEMPLATE_ID;
  }

  const sameName = await prisma.diagnosticTemplate.findFirst({
    where: { tenantId: null, name: DEFAULT_INTAKE_TEMPLATE_NAME },
    select: { id: true },
  });
  if (sameName) {
    console.log(`= Ижил нэртэй системийн загвар байна (${sameName.id}) — шинээр үүсгэсэнгүй.`);
    return sameName.id;
  }

  await prisma.diagnosticTemplate.create({
    data: {
      id: SYSTEM_TEMPLATE_ID,
      tenantId: null,
      name: DEFAULT_INTAKE_TEMPLATE_NAME,
      type: "INTAKE",
      schema: DEFAULT_INTAKE_TEMPLATE_SCHEMA as Prisma.InputJsonValue,
    },
  });
  console.log(`+ Системийн загвар үүсгэв (${SYSTEM_TEMPLATE_ID}).`);
  return SYSTEM_TEMPLATE_ID;
}

async function grant(templateId: string): Promise<void> {
  if (!grantAll && grantIds.length === 0) {
    console.log("  Grant өгөөгүй — /system/diagnostic-templates дээрээс байгууллага сонгоно уу.");
    return;
  }
  const tenants = await prisma.tenant.findMany({
    where: grantAll ? {} : { id: { in: grantIds } },
    select: { id: true },
  });
  const missing = grantIds.filter((id) => !tenants.some((t) => t.id === id));
  if (missing.length > 0) console.warn(`! Олдоогүй байгууллага: ${missing.join(", ")}`);

  const { count } = await prisma.diagnosticTemplateGrant.createMany({
    data: tenants.map((t) => ({ templateId, tenantId: t.id })),
    skipDuplicates: true,
  });
  console.log(`+ Grant: ${count} шинэ (${tenants.length - count} өмнө нь байсан).`);
}

async function main() {
  setBypassContext();
  const templateId = await upsertTemplate();
  await grant(templateId);
}

main()
  .catch((e) => {
    console.error("Оношилгооны загварын seed алдаа:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
