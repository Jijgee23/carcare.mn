-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "accountVehicleId" TEXT,
ADD COLUMN     "vehicleId" TEXT;

-- CreateTable
CREATE TABLE "AccountVehicle" (
    "id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "vin" TEXT,
    "fuelType" TEXT,
    "mileage" INTEGER,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountVehicle_accountId_idx" ON "AccountVehicle"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountVehicle_accountId_plate_key" ON "AccountVehicle"("accountId", "plate");

-- AddForeignKey
ALTER TABLE "AccountVehicle" ADD CONSTRAINT "AccountVehicle_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_accountVehicleId_fkey" FOREIGN KEY ("accountVehicleId") REFERENCES "AccountVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
