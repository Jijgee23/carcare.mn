-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "systemServiceKeyId" TEXT;

-- CreateTable
CREATE TABLE "SystemServiceKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemServiceKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemServiceKey_name_key" ON "SystemServiceKey"("name");

-- CreateIndex
CREATE INDEX "SystemServiceKey_isActive_idx" ON "SystemServiceKey"("isActive");

-- CreateIndex
CREATE INDEX "Category_systemServiceKeyId_idx" ON "Category"("systemServiceKeyId");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_systemServiceKeyId_fkey" FOREIGN KEY ("systemServiceKeyId") REFERENCES "SystemServiceKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemServiceKey" ADD CONSTRAINT "SystemServiceKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "SuperAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
