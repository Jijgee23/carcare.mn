-- AlterTable
ALTER TABLE "DiagnosticTemplate" ADD COLUMN "isSystemDefault" BOOLEAN NOT NULL DEFAULT false;

-- DataMigration
-- Аль хэдийн үүссэн системийн үндсэн загваруудыг (харах: 20260908020000_
-- default_intake_diagnostic_template) тэмдэглэж, тухайн тенант засах/устгах
-- боломжгүй болгоно (харах: app/_actions/diagnostic-templates.ts).
UPDATE "DiagnosticTemplate"
SET "isSystemDefault" = true
WHERE "name" = 'Ерөнхий үзлэг (хүлээж авах)';
