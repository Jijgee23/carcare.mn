/*
  Warnings:

  - You are about to drop the column `workDays` on the `Branch` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT');

-- AlterTable
ALTER TABLE "Branch" DROP COLUMN "workDays";

-- CreateTable
CREATE TABLE "BranchSchedule" (
    "id" TEXT NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "openTime" TEXT,
    "closeTime" TEXT,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BranchSchedule_weekday_isOpen_idx" ON "BranchSchedule"("weekday", "isOpen");

-- CreateIndex
CREATE UNIQUE INDEX "BranchSchedule_branchId_weekday_key" ON "BranchSchedule"("branchId", "weekday");

-- AddForeignKey
ALTER TABLE "BranchSchedule" ADD CONSTRAINT "BranchSchedule_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
