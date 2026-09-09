/**
 * `DiagnosticReport.maxSeverity` (харах: 20260909000000_diagnostic_report_severity)
 * нь зөвхөн шинээр үүсэх тайланд `createReportAction` дотор тооцогдоно.
 * Миграцийн өмнөх бүх тайлан `maxSeverity=NULL` хэвээр үлдэх тул энэ нэг
 * удаагийн скрипт тэдгээрийг тус тусын загварын schema-тай харьцуулж
 * гүйцэд тооцоолж дүүргэнэ (харах: lib/diagnostics.ts-ийн computeReportSeverity).
 *
 * Эхлээд тоолж хараарай (dry-run, өөрчлөлт хийхгүй):
 *   npx tsx scripts/backfill-diagnostic-report-severity.ts --dry-run
 *
 * Дараа нь бодитоор гүйцэтгэх бол:
 *   npx tsx scripts/backfill-diagnostic-report-severity.ts
 */

import "dotenv/config";
import { computeReportSeverity, type ReportData, type TemplateSchema } from "@/lib/diagnostics";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  // Бүх tenant дундуур bulk update хийдэг скрипт тул RLS-г тойрч гарна.
  setBypassContext();

  const reports = await prisma.diagnosticReport.findMany({
    where: { maxSeverity: null },
    select: {
      id: true,
      data: true,
      template: { select: { schema: true } },
    },
  });

  if (reports.length === 0) {
    console.log("✔ Тооцоолох шаардлагатай тайлан алга.");
    return;
  }

  const toUpdate: { id: string; severity: "GOOD" | "WARN" | "BAD" }[] = [];
  let noCheckItems = 0;
  let badSchema = 0;

  for (const r of reports) {
    let schema: TemplateSchema;
    try {
      schema = r.template.schema as unknown as TemplateSchema;
      if (!schema.sections) throw new Error("no sections");
    } catch {
      badSchema += 1;
      continue;
    }
    const severity = computeReportSeverity(schema, r.data as ReportData);
    if (severity === null) {
      noCheckItems += 1;
      continue;
    }
    toUpdate.push({ id: r.id, severity });
  }

  console.log(`Нийт шалгасан тайлан: ${reports.length}`);
  console.log(`Шинэчлэх: ${toUpdate.length}`);
  console.log(`Check хариулт алга (алгассан): ${noCheckItems}`);
  console.log(`Загвар унших боломжгүй (алгассан): ${badSchema}`);

  if (dryRun) {
    console.log("\n--dry-run тул өөрчлөлт хийгдээгүй.");
    return;
  }

  let updated = 0;
  for (const u of toUpdate) {
    await prisma.diagnosticReport.update({
      where: { id: u.id },
      data: { maxSeverity: u.severity },
    });
    updated += 1;
  }
  console.log(`✔ ${updated} тайланг шинэчиллээ.`);
}

main()
  .catch((err) => {
    console.error("Алдаа:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
