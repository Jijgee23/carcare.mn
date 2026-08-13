-- Дараа төлбөрт (гэрээт) машин: TenantVehicle тохиргоо + ServiceOrder snapshot.
ALTER TABLE "TenantVehicle" ADD COLUMN "isPostpaid" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ServiceOrder" ADD COLUMN "isPostpaid" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ServiceOrder_tenantId_isPostpaid_idx" ON "ServiceOrder"("tenantId", "isPostpaid");
