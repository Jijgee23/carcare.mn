-- AlterTable
-- ServiceItem(kind=DIAGNOSTIC) мөрийг эх загвартайгаа, мөн (бөглөгдсөний
-- дараа) DiagnosticReport-той нь холбоно. Урьд тусдаа OrderDiagnostic
-- (товлосон, үнэгүй "хийх ёстой" жагсаалт) ба ServiceItem(kind=DIAGNOSTIC)
-- (үнэтэй мөр) хоорондоо огт холбоогүй байсныг нэгтгэсэн хэсэг.
ALTER TABLE "ServiceItem"
  ADD COLUMN "diagnosticTemplateId" TEXT,
  ADD COLUMN "diagnosticReportId" TEXT;

-- CreateIndex
CREATE INDEX "ServiceItem_diagnosticTemplateId_idx" ON "ServiceItem"("diagnosticTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceItem_diagnosticReportId_key" ON "ServiceItem"("diagnosticReportId");

-- AddForeignKey
ALTER TABLE "ServiceItem" ADD CONSTRAINT "ServiceItem_diagnosticTemplateId_fkey"
  FOREIGN KEY ("diagnosticTemplateId") REFERENCES "DiagnosticTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceItem" ADD CONSTRAINT "ServiceItem_diagnosticReportId_fkey"
  FOREIGN KEY ("diagnosticReportId") REFERENCES "DiagnosticReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DataMigration
-- Хараахан бөглөгдөөгүй (одоо ч OrderDiagnostic мөртэй) товлогдсон
-- оношилгоонуудыг үнэтэй ServiceItem мөр болгон хөрвүүлнэ (PENDING).
-- Аль хэдийн бөглөгдсөн (тайлантай) оношилгоонд харгалзах OrderDiagnostic
-- мөр хуучин логикоор аль хэдийн УСТГАГДСАН байдаг тул энд орохгүй — тэдгээрийг
-- ретроактиваар мөр нэмж (шинэ дүн нэмж) аль хэдийн хаагдсан/төлбөр
-- тооцоологдсон захиалгын дүнг гажуудуулахгүйн тулд санаатайгаар хөндөхгүй.
INSERT INTO "ServiceItem"
  ("id", "kind", "description", "quantity", "unitPrice", "total", "status",
   "orderId", "diagnosticTemplateId", "createdAt", "updatedAt")
SELECT
  'svcitem_' || md5(od."id" || '-diag-migrate') AS "id",
  'DIAGNOSTIC' AS "kind",
  dt."name" AS "description",
  1 AS "quantity",
  COALESCE(dt."price", 0) AS "unitPrice",
  COALESCE(dt."price", 0) AS "total",
  'PENDING' AS "status",
  od."orderId" AS "orderId",
  od."templateId" AS "diagnosticTemplateId",
  od."createdAt" AS "createdAt",
  od."createdAt" AS "updatedAt"
FROM "OrderDiagnostic" od
JOIN "DiagnosticTemplate" dt ON dt."id" = od."templateId";

-- Шинээр нэмэгдсэн мөрүүдийн дүнгээр холбогдох захиалгын нийт дүнг нэмж дахин
-- тооцно (шинэ мөрүүд бүгд PENDING тул цуцлагдсан гэж тооцогдохгүй).
UPDATE "ServiceOrder" so
SET "totalAmount" = COALESCE(so."totalAmount", 0) + sub."added"
FROM (
  SELECT od."orderId" AS "orderId", SUM(COALESCE(dt."price", 0)) AS "added"
  FROM "OrderDiagnostic" od
  JOIN "DiagnosticTemplate" dt ON dt."id" = od."templateId"
  GROUP BY od."orderId"
) sub
WHERE so."id" = sub."orderId";

-- DropForeignKey
ALTER TABLE "OrderDiagnostic" DROP CONSTRAINT "OrderDiagnostic_orderId_fkey";

-- DropForeignKey
ALTER TABLE "OrderDiagnostic" DROP CONSTRAINT "OrderDiagnostic_templateId_fkey";

-- DropTable
DROP TABLE "OrderDiagnostic";
