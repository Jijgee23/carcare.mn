-- Postgres Row-Level Security pilot — Category, Unit дээр туршиж, бусад
-- tenant-scoped хүснэгтэд өргөтгөхийн өмнө баталгаажуулна.
--
-- app.tenant_id session variable (SET LOCAL, prisma extension-аар тавигдана)
-- нь тухайн query-г тэр tenant-д хязгаарлана. app.bypass_rls='on' бол
-- cross-tenant (system admin, cron, webhook, Account урсгал) чөлөөтэй.
--
-- FORCE ROW LEVEL SECURITY зайлшгүй — прод дээр апп өөрөө DB owner (`carcare`
-- role, docs/deploy-ubuntu.md) тул FORCE-гүй бол өөрийн эзэмшлийн хүснэгтэд
-- RLS-г үл тоомсорлоно.

ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Category"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "tenantId" = current_setting('app.tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "tenantId" = current_setting('app.tenant_id', true)
  );

ALTER TABLE "Unit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Unit" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Unit"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "tenantId" = current_setting('app.tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "tenantId" = current_setting('app.tenant_id', true)
  );
