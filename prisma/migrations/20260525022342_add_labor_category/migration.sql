-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "laborCategoryId" TEXT;

-- CreateTable
CREATE TABLE "LaborCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaborCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LaborCategory_tenantId_isActive_idx" ON "LaborCategory"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LaborCategory_tenantId_name_key" ON "LaborCategory"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Service_laborCategoryId_idx" ON "Service"("laborCategoryId");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_laborCategoryId_fkey" FOREIGN KEY ("laborCategoryId") REFERENCES "LaborCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborCategory" ADD CONSTRAINT "LaborCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
