-- Web hardening S9-1: ServiceOrder FK columns had no index, so customer/vehicle
-- history, technician workload and Restrict-cascade checks seq-scanned the table.
-- Additive only; no data change.
CREATE INDEX IF NOT EXISTS "ServiceOrder_customerId_idx" ON "ServiceOrder"("customerId");
CREATE INDEX IF NOT EXISTS "ServiceOrder_vehicleId_idx" ON "ServiceOrder"("vehicleId");
CREATE INDEX IF NOT EXISTS "ServiceOrder_assignedToId_idx" ON "ServiceOrder"("assignedToId");
