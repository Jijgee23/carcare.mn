-- AlterTable
ALTER TABLE "DiagnosticTemplate" ADD COLUMN     "createdBySystemAdminId" TEXT,
ALTER COLUMN "tenantId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DiagnosticTemplateGrant" (
    "templateId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosticTemplateGrant_pkey" PRIMARY KEY ("templateId","tenantId")
);

-- CreateIndex
CREATE INDEX "DiagnosticTemplateGrant_tenantId_idx" ON "DiagnosticTemplateGrant"("tenantId");

-- AddForeignKey
ALTER TABLE "DiagnosticTemplate" ADD CONSTRAINT "DiagnosticTemplate_createdBySystemAdminId_fkey" FOREIGN KEY ("createdBySystemAdminId") REFERENCES "SuperAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticTemplateGrant" ADD CONSTRAINT "DiagnosticTemplateGrant_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DiagnosticTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticTemplateGrant" ADD CONSTRAINT "DiagnosticTemplateGrant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: DiagnosticTemplate.tenantId одоо NULL байж болно (систем admin-аас
-- үүсгэсэн, DiagnosticTemplateGrant-аар байгууллагуудад олгосон загвар).
-- Хуучин бодлого зөвхөн өөрийн tenantId-г зөвшөөрдөг байсныг өргөтгөж,
-- NULL мөрийг зөвхөн ГРАНТ авсан тенант харах боломжтой болгоно (харах:
-- 20260813070000_rls_remaining_tenant_tables). WITH CHECK хатуу хэвээр —
-- тенант session-ээс шууд NULL tenantId-тай мөр бичих боломжгүй, зөвхөн
-- bypass (систем admin) горимд л бичигдэнэ.
DROP POLICY tenant_isolation ON "DiagnosticTemplate";
CREATE POLICY tenant_isolation ON "DiagnosticTemplate"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "tenantId" = current_setting('app.tenant_id', true)
    OR (
      "tenantId" IS NULL
      AND EXISTS (
        SELECT 1 FROM "DiagnosticTemplateGrant" g
        WHERE g."templateId" = "DiagnosticTemplate".id
          AND g."tenantId" = current_setting('app.tenant_id', true)
      )
    )
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "tenantId" = current_setting('app.tenant_id', true)
  );

ALTER TABLE "DiagnosticTemplateGrant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiagnosticTemplateGrant" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "DiagnosticTemplateGrant"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));
