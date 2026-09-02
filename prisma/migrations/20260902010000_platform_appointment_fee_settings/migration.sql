-- AlterTable
ALTER TABLE "PlatformSetting" ADD COLUMN     "appointmentFeeAmount" DECIMAL(12,2) NOT NULL DEFAULT 1000,
ADD COLUMN     "appointmentFeeEnabled" BOOLEAN NOT NULL DEFAULT true;
