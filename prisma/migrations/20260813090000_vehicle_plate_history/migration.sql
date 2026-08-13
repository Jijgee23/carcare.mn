-- Vehicle-ийн улсын дугаар солигдсон түүх (resolveVehicle илрүүлэх бүрд бичигдэнэ).
CREATE TABLE "VehiclePlateHistory" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehiclePlateHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VehiclePlateHistory_vehicleId_changedAt_idx" ON "VehiclePlateHistory"("vehicleId", "changedAt");

ALTER TABLE "VehiclePlateHistory" ADD CONSTRAINT "VehiclePlateHistory_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
