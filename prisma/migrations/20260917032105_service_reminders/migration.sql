-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "reminderIntervalMonths" INTEGER;

-- AlterTable
ALTER TABLE "ServiceItem" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);
