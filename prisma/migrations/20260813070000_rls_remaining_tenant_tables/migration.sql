-- Postgres RLS-ийг үлдсэн 16 tenant-scoped хүснэгтэд өргөтгөнө (Category/Unit
-- pilot-оор баталгаажсаны дараа). Загвар: 20260813060000_rls_pilot_category_unit
-- migration-тай яг адил (app.tenant_id / app.bypass_rls session variable).
--
-- Notification.tenantId nullable (Account талын мөрд NULL) — тэдгээрийг зөвхөн
-- bypass горимд (lib/auth/account.ts-ийн requireAccount/getAccount) уншина.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "User"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Role" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Role"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Branch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Branch" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Branch"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Customer" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Customer"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "TenantVehicle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantVehicle" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TenantVehicle"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "ServiceOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceOrder" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ServiceOrder"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Service" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Service" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Service"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "DiagnosticTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiagnosticTemplate" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "DiagnosticTemplate"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "DiagnosticReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiagnosticReport" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "DiagnosticReport"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "TenantQPaySettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantQPaySettings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TenantQPaySettings"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "OrderPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderPayment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "OrderPayment"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "SubscriptionPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubscriptionPayment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SubscriptionPayment"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Subscription"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Appointment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Appointment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Appointment"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

-- Notification.tenantId nullable (Account талын мөрд NULL — зөвхөн bypass-аар уншина).
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Notification"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AuditLog"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));
