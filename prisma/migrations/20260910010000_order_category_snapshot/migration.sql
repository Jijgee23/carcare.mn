-- CreateTable
CREATE TABLE "ServiceOrderCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceOrderCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrderCategory_orderId_categoryId_key" ON "ServiceOrderCategory"("orderId", "categoryId");

-- CreateIndex
CREATE INDEX "ServiceOrderCategory_tenantId_orderId_idx" ON "ServiceOrderCategory"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "ServiceOrderCategory_categoryId_idx" ON "ServiceOrderCategory"("categoryId");

-- AddForeignKey
ALTER TABLE "ServiceOrderCategory" ADD CONSTRAINT "ServiceOrderCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderCategory" ADD CONSTRAINT "ServiceOrderCategory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderCategory" ADD CONSTRAINT "ServiceOrderCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tenant isolation
ALTER TABLE "ServiceOrderCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceOrderCategory" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ServiceOrderCategory"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));
