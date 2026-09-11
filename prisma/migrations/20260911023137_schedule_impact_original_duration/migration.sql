-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "originalEstimatedDurationMinutes" INTEGER;

-- AlterTable
ALTER TABLE "OrderTimeBooking" ADD COLUMN     "originalDurationMinutes" INTEGER;

-- S13: backfill both new columns from current values, the best available
-- approximation for rows that predate this column (a row already clipped
-- before today loses its true original — this backfill can only reconstruct
-- "original = current" for rows never clipped).
UPDATE "Appointment" SET "originalEstimatedDurationMinutes" = "estimatedDurationMinutes"
  WHERE "originalEstimatedDurationMinutes" IS NULL;

UPDATE "OrderTimeBooking" SET "originalDurationMinutes" =
  CASE WHEN "endAt" IS NOT NULL THEN ROUND(EXTRACT(EPOCH FROM ("endAt" - "startAt")) / 60) ELSE NULL END
  WHERE "originalDurationMinutes" IS NULL;
