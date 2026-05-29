-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activeUntil" TIMESTAMP(3),
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "User_tenantId_isActive_idx" ON "User"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "User_activeUntil_idx" ON "User"("activeUntil");
