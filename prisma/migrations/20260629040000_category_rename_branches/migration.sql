-- LaborCategory → Category (бүх төрлийн Service-д), Branch↔Category олон-олон,
-- Appointment.categoryId. Дата хадгалахын тулд DROP биш RENAME ашиглана.

-- 1) LaborCategory → Category (хүснэгт + constraint + index нэрс) ------------
ALTER TABLE "LaborCategory" RENAME TO "Category";
ALTER TABLE "Category" RENAME CONSTRAINT "LaborCategory_pkey" TO "Category_pkey";
ALTER TABLE "Category" RENAME CONSTRAINT "LaborCategory_tenantId_fkey" TO "Category_tenantId_fkey";
ALTER INDEX "LaborCategory_tenantId_name_key" RENAME TO "Category_tenantId_name_key";
ALTER INDEX "LaborCategory_tenantId_isActive_idx" RENAME TO "Category_tenantId_isActive_idx";

-- 2) Service.laborCategoryId → categoryId ------------------------------------
ALTER TABLE "Service" RENAME COLUMN "laborCategoryId" TO "categoryId";
ALTER TABLE "Service" RENAME CONSTRAINT "Service_laborCategoryId_fkey" TO "Service_categoryId_fkey";
ALTER INDEX "Service_laborCategoryId_idx" RENAME TO "Service_categoryId_idx";

-- 3) Appointment.categoryId --------------------------------------------------
ALTER TABLE "Appointment" ADD COLUMN "categoryId" TEXT;
CREATE INDEX "Appointment_categoryId_idx" ON "Appointment"("categoryId");
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4) Branch ↔ Category олон-олон (Prisma implicit join) ----------------------
CREATE TABLE "_BranchToCategory" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_BranchToCategory_AB_pkey" PRIMARY KEY ("A", "B")
);
CREATE INDEX "_BranchToCategory_B_index" ON "_BranchToCategory"("B");
ALTER TABLE "_BranchToCategory" ADD CONSTRAINT "_BranchToCategory_A_fkey"
  FOREIGN KEY ("A") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_BranchToCategory" ADD CONSTRAINT "_BranchToCategory_B_fkey"
  FOREIGN KEY ("B") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
