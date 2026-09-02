-- RLS: tenant_isolation policy (OrderPayment/SubscriptionPayment-тэй адил хэв
-- маяг — tenantId NOT NULL, зөвхөн тухайн тенант эсвэл app.bypass_rls='on'
-- (Account талын урсгал) уншина/бичнэ).
ALTER TABLE "AppointmentPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppointmentPayment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AppointmentPayment"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));
