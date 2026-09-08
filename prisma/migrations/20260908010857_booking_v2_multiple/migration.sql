-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "arrivedAt" TIMESTAMP(3),
ADD COLUMN     "estimatedDurationMinutes" INTEGER;

-- AlterTable
ALTER TABLE "ServiceItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ServiceOrder" ADD COLUMN     "estimatedDurationMinutes" INTEGER,
ADD COLUMN     "expectedFinishAt" TIMESTAMP(3),
ADD COLUMN     "occupiesCapacity" BOOLEAN;
