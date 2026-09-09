-- CreateEnum
CREATE TYPE "ReportSeverity" AS ENUM ('GOOD', 'WARN', 'BAD');

-- AlterTable
ALTER TABLE "DiagnosticReport" ADD COLUMN "maxSeverity" "ReportSeverity";

-- CreateIndex
CREATE INDEX "DiagnosticReport_tenantId_maxSeverity_idx" ON "DiagnosticReport"("tenantId", "maxSeverity");
