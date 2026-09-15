-- DropForeignKey
ALTER TABLE "EmployeeScheduleException" DROP CONSTRAINT "EmployeeScheduleException_branchId_fkey";

-- DropForeignKey
ALTER TABLE "EmployeeWorkSchedule" DROP CONSTRAINT "EmployeeWorkSchedule_branchId_fkey";

-- DropIndex
DROP INDEX "EmployeeWorkSchedule_branchId_idx";

-- AlterTable
ALTER TABLE "EmployeeScheduleException" DROP COLUMN "branchId",
DROP COLUMN "endTime",
DROP COLUMN "startTime";

-- AlterTable
ALTER TABLE "EmployeeWorkSchedule" DROP COLUMN "branchId",
DROP COLUMN "endTime",
DROP COLUMN "startTime";

-- CreateTable
CREATE TABLE "EmployeeWorkScheduleSegment" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "startTime" TEXT,
    "endTime" TEXT,
    "scheduleId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "EmployeeWorkScheduleSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeScheduleExceptionSegment" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "startTime" TEXT,
    "endTime" TEXT,
    "exceptionId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "EmployeeScheduleExceptionSegment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeWorkScheduleSegment_scheduleId_idx" ON "EmployeeWorkScheduleSegment"("scheduleId");

-- CreateIndex
CREATE INDEX "EmployeeWorkScheduleSegment_branchId_idx" ON "EmployeeWorkScheduleSegment"("branchId");

-- CreateIndex
CREATE INDEX "EmployeeScheduleExceptionSegment_exceptionId_idx" ON "EmployeeScheduleExceptionSegment"("exceptionId");

-- CreateIndex
CREATE INDEX "EmployeeScheduleExceptionSegment_branchId_idx" ON "EmployeeScheduleExceptionSegment"("branchId");

-- AddForeignKey
ALTER TABLE "EmployeeWorkScheduleSegment" ADD CONSTRAINT "EmployeeWorkScheduleSegment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "EmployeeWorkSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeWorkScheduleSegment" ADD CONSTRAINT "EmployeeWorkScheduleSegment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeScheduleExceptionSegment" ADD CONSTRAINT "EmployeeScheduleExceptionSegment_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "EmployeeScheduleException"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeScheduleExceptionSegment" ADD CONSTRAINT "EmployeeScheduleExceptionSegment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
