-- CreateTable
CREATE TABLE "EmployeeWorkSchedule" (
    "id" TEXT NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "isWorking" BOOLEAN NOT NULL DEFAULT true,
    "startTime" TEXT,
    "endTime" TEXT,
    "branchId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeWorkSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeScheduleException" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "isWorking" BOOLEAN NOT NULL DEFAULT true,
    "startTime" TEXT,
    "endTime" TEXT,
    "label" TEXT,
    "branchId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeScheduleException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeWorkSchedule_userId_idx" ON "EmployeeWorkSchedule"("userId");

-- CreateIndex
CREATE INDEX "EmployeeWorkSchedule_branchId_idx" ON "EmployeeWorkSchedule"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeWorkSchedule_userId_weekday_key" ON "EmployeeWorkSchedule"("userId", "weekday");

-- CreateIndex
CREATE INDEX "EmployeeScheduleException_userId_date_idx" ON "EmployeeScheduleException"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeScheduleException_userId_date_key" ON "EmployeeScheduleException"("userId", "date");

-- AddForeignKey
ALTER TABLE "EmployeeWorkSchedule" ADD CONSTRAINT "EmployeeWorkSchedule_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeWorkSchedule" ADD CONSTRAINT "EmployeeWorkSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeScheduleException" ADD CONSTRAINT "EmployeeScheduleException_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeScheduleException" ADD CONSTRAINT "EmployeeScheduleException_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
