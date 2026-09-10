-- CreateEnum
CREATE TYPE "OrderBookingKind" AS ENUM ('SCHEDULED', 'ACTIVE');

-- CreateTable
CREATE TABLE "OrderTimeBooking" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "kind" "OrderBookingKind" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderTimeBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderTimeBooking_tenantId_branchId_startAt_idx" ON "OrderTimeBooking"("tenantId", "branchId", "startAt");

-- CreateIndex
CREATE INDEX "OrderTimeBooking_orderId_idx" ON "OrderTimeBooking"("orderId");

-- AddForeignKey
ALTER TABLE "OrderTimeBooking" ADD CONSTRAINT "OrderTimeBooking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderTimeBooking" ADD CONSTRAINT "OrderTimeBooking_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderTimeBooking" ADD CONSTRAINT "OrderTimeBooking_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderTimeBooking" ADD CONSTRAINT "OrderTimeBooking_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tenant isolation
ALTER TABLE "OrderTimeBooking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderTimeBooking" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "OrderTimeBooking"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));
