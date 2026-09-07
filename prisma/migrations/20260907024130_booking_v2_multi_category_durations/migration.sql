-- DropForeignKey
ALTER TABLE "District" DROP CONSTRAINT "District_cityId_fkey";

-- DropForeignKey
ALTER TABLE "Khoroo" DROP CONSTRAINT "Khoroo_cityId_fkey";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "durationMinutes" INTEGER;

-- CreateTable
CREATE TABLE "AppointmentCategory" (
    "appointmentId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentCategory_pkey" PRIMARY KEY ("appointmentId","categoryId")
);

-- CreateTable
CREATE TABLE "BranchCategoryDuration" (
    "branchId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchCategoryDuration_pkey" PRIMARY KEY ("branchId","categoryId")
);

-- CreateIndex
CREATE INDEX "AppointmentCategory_categoryId_idx" ON "AppointmentCategory"("categoryId");

-- CreateIndex
CREATE INDEX "BranchCategoryDuration_categoryId_idx" ON "BranchCategoryDuration"("categoryId");

-- AddForeignKey
ALTER TABLE "AppointmentCategory" ADD CONSTRAINT "AppointmentCategory_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentCategory" ADD CONSTRAINT "AppointmentCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchCategoryDuration" ADD CONSTRAINT "BranchCategoryDuration_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchCategoryDuration" ADD CONSTRAINT "BranchCategoryDuration_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "District" ADD CONSTRAINT "District_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Khoroo" ADD CONSTRAINT "Khoroo_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
