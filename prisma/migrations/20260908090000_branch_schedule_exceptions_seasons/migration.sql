-- Branch operating-hours exceptions and seasonal schedules.
CREATE TABLE "BranchScheduleException" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "openTime" TEXT,
    "closeTime" TEXT,
    "label" TEXT,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchScheduleException_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BranchScheduleSeason" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchScheduleSeason_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BranchScheduleSeasonDay" (
    "seasonId" TEXT NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "openTime" TEXT,
    "closeTime" TEXT,

    CONSTRAINT "BranchScheduleSeasonDay_pkey" PRIMARY KEY ("seasonId", "weekday")
);

CREATE UNIQUE INDEX "BranchScheduleException_branchId_date_key" ON "BranchScheduleException"("branchId", "date");
CREATE INDEX "BranchScheduleException_branchId_date_idx" ON "BranchScheduleException"("branchId", "date");
CREATE INDEX "BranchScheduleSeason_branchId_startsOn_endsOn_idx" ON "BranchScheduleSeason"("branchId", "startsOn", "endsOn");
CREATE INDEX "BranchScheduleSeason_branchId_isActive_idx" ON "BranchScheduleSeason"("branchId", "isActive");
CREATE INDEX "BranchScheduleSeasonDay_weekday_isOpen_idx" ON "BranchScheduleSeasonDay"("weekday", "isOpen");

ALTER TABLE "BranchScheduleException" ADD CONSTRAINT "BranchScheduleException_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BranchScheduleSeason" ADD CONSTRAINT "BranchScheduleSeason_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BranchScheduleSeasonDay" ADD CONSTRAINT "BranchScheduleSeasonDay_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "BranchScheduleSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
