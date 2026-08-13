-- Phase 1: Vehicle-ийг global "hub" болгож, tenant харьяаллыг TenantVehicle руу шилжүүлнэ.
--
-- Дарааллын зарчим (буцаах боломжгүй — прод дээр заавал backup):
--   1. TenantVehicle хүснэгт үүсгэх (unique/FK-г СҮҮЛД нэмнэ).
--   2. Vehicle мөр бүрээс tenant+customer-ийг TenantVehicle руу backfill.
--   3. Давхардсан машинуудыг нэгтгэх canonical map (VIN тэргүүлэх, plate fallback).
--   4. TenantVehicle.vehicleId-г canonical руу шилжүүлэх.
--   5. Засварын түүхийн FK-уудыг canonical руу repoint.
--   6. Давхар TenantVehicle-уудыг цэвэрлэх.
--   7. Non-canonical Vehicle мөрүүдийг устгах.
--   8. Vehicle-аас tenant/customer багана + хязгаарлалтыг арилгах.
--   9. Vehicle дээр vin/plate global unique нэмэх.
--  10. TenantVehicle index/unique/FK нэмэх.

-- 1) TenantVehicle хүснэгт ---------------------------------------------------
CREATE TABLE "TenantVehicle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "customerId" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenantVehicle_pkey" PRIMARY KEY ("id")
);

-- 2) Backfill: Vehicle мөр бүрд нэг TenantVehicle ----------------------------
INSERT INTO "TenantVehicle" ("id", "tenantId", "vehicleId", "customerId", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "tenantId", "id", "customerId", true, "createdAt", "updatedAt"
FROM "Vehicle";

-- 3) Canonical map: түлхүүр = VIN (байвал) ЭСВЭЛ plate -----------------------
CREATE TEMP TABLE _veh_map AS
WITH keyed AS (
  SELECT "id",
         CASE WHEN "vin" IS NOT NULL AND btrim("vin") <> ''
              THEN 'VIN:' || upper(btrim("vin"))
              ELSE 'PLATE:' || upper(btrim("plate")) END AS k,
         "updatedAt"
  FROM "Vehicle"
),
canon AS (
  SELECT DISTINCT ON (k) k, "id" AS canonical_id
  FROM keyed ORDER BY k, "updatedAt" DESC, "id"
)
SELECT kd."id" AS old_id, c.canonical_id
FROM keyed kd JOIN canon c ON kd.k = c.k;

-- 3b) Ижил plate-тай боловч өөр түлхүүртэй (нэг нь VIN-тэй, нөгөө нь VIN-гүй)
--     canonical мөрүүдийг plate-аар нэгтгэх. VIN-тэйг нь тэргүүлнэ.
CREATE TEMP TABLE _plate_map AS
WITH canon AS (
  SELECT DISTINCT canonical_id FROM _veh_map
),
ranked AS (
  SELECT v."id",
         first_value(v."id") OVER (
           PARTITION BY upper(btrim(v."plate"))
           ORDER BY (v."vin" IS NOT NULL) DESC, v."updatedAt" DESC, v."id"
         ) AS canonical_id
  FROM "Vehicle" v JOIN canon ON v."id" = canon.canonical_id
)
SELECT "id" AS old_id, canonical_id FROM ranked;

-- 3c) Хоёр map-г нэгтгэх: old → veh_canon → plate_canon ----------------------
CREATE TEMP TABLE _final_map AS
SELECT m.old_id,
       COALESCE(p.canonical_id, m.canonical_id) AS canonical_id
FROM _veh_map m
LEFT JOIN _plate_map p ON m.canonical_id = p.old_id;

-- 4) TenantVehicle.vehicleId → canonical -------------------------------------
UPDATE "TenantVehicle" tv
SET "vehicleId" = fm.canonical_id
FROM _final_map fm
WHERE tv."vehicleId" = fm.old_id AND fm.canonical_id <> fm.old_id;

-- 5) Засварын түүхийн FK-ууд → canonical -------------------------------------
UPDATE "ServiceOrder" s SET "vehicleId" = fm.canonical_id
FROM _final_map fm WHERE s."vehicleId" = fm.old_id AND fm.canonical_id <> fm.old_id;
UPDATE "DiagnosticReport" d SET "vehicleId" = fm.canonical_id
FROM _final_map fm WHERE d."vehicleId" = fm.old_id AND fm.canonical_id <> fm.old_id;
UPDATE "Appointment" a SET "vehicleId" = fm.canonical_id
FROM _final_map fm WHERE a."vehicleId" = fm.old_id AND fm.canonical_id <> fm.old_id;

-- 6) Нэг (tenantId, vehicleId)-д нэг л TenantVehicle үлдээх -------------------
--    customerId-тэйг нь, дараа нь хамгийн эртийг тэргүүлнэ.
DELETE FROM "TenantVehicle"
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", row_number() OVER (
      PARTITION BY "tenantId", "vehicleId"
      ORDER BY ("customerId" IS NOT NULL) DESC, "createdAt" ASC, "id"
    ) AS rn
    FROM "TenantVehicle"
  ) t WHERE t.rn > 1
);

-- 7) Non-canonical Vehicle устгах --------------------------------------------
DELETE FROM "Vehicle" v
USING _final_map fm
WHERE v."id" = fm.old_id AND fm.canonical_id <> fm.old_id;

-- 8) Vehicle-ийг global болгох -----------------------------------------------
ALTER TABLE "Vehicle" DROP CONSTRAINT "Vehicle_tenantId_fkey";
ALTER TABLE "Vehicle" DROP CONSTRAINT "Vehicle_customerId_fkey";
DROP INDEX "Vehicle_tenantId_plate_key";
DROP INDEX "Vehicle_tenantId_idx";
ALTER TABLE "Vehicle" DROP COLUMN "tenantId";
ALTER TABLE "Vehicle" DROP COLUMN "customerId";

-- 9) Хоосон VIN-г NULL болгож, plate-г нормчилоод global unique нэмэх ---------
UPDATE "Vehicle" SET "vin" = NULL WHERE "vin" IS NOT NULL AND btrim("vin") = '';
UPDATE "Vehicle" SET "plate" = upper(btrim("plate"));
CREATE UNIQUE INDEX "Vehicle_vin_key" ON "Vehicle"("vin");
CREATE UNIQUE INDEX "Vehicle_plate_key" ON "Vehicle"("plate");

-- 10) TenantVehicle index/unique/FK ------------------------------------------
CREATE UNIQUE INDEX "TenantVehicle_tenantId_vehicleId_key" ON "TenantVehicle"("tenantId", "vehicleId");
CREATE INDEX "TenantVehicle_tenantId_idx" ON "TenantVehicle"("tenantId");
CREATE INDEX "TenantVehicle_customerId_idx" ON "TenantVehicle"("customerId");

ALTER TABLE "TenantVehicle" ADD CONSTRAINT "TenantVehicle_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantVehicle" ADD CONSTRAINT "TenantVehicle_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantVehicle" ADD CONSTRAINT "TenantVehicle_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
