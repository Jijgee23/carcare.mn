-- D-078 (COWORK.md): structured order status-change history, separate from
-- the generic AuditLog (JSON before/after isn't reportable) — reason/reasonTag
-- only populated for postpone transitions; "waiting for parts" now lives here
-- as a tag, not as an OrderStatus value.

-- CreateEnum
CREATE TYPE "OrderPostponeReasonTag" AS ENUM ('WAITING_PARTS', 'WAITING_CUSTOMER', 'NEEDS_DIAGNOSIS', 'OTHER');

-- CreateTable
CREATE TABLE "OrderStatusChange" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "reason" TEXT,
    "reasonTag" "OrderPostponeReasonTag",
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderStatusChange_tenantId_orderId_createdAt_idx" ON "OrderStatusChange"("tenantId", "orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderStatusChange" ADD CONSTRAINT "OrderStatusChange_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusChange" ADD CONSTRAINT "OrderStatusChange_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusChange" ADD CONSTRAINT "OrderStatusChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tenant isolation
ALTER TABLE "OrderStatusChange" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderStatusChange" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "OrderStatusChange"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));
