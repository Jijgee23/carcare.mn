-- Phase 4: AccountVehicle-ийг global Vehicle руу заасан нимгэн link болгоно.
--
-- Дараалал (буцаахад хүнд — прод дээр backup):
--   1. vehicleId багана (nullable) нэмэх.
--   2. VIN-ээр, дараа plate-ээр global Vehicle-тэй тааруулах.
--   3. Тааараагүйд нь шинэ global Vehicle үүсгэх (key-ээр нэгтгэж).
--   4. Нэг (accountId, vehicleId)-д давхар AccountVehicle үлдвэл нэгтгэх
--      (Appointment.accountVehicleId-г survivor руу repoint).
--   5. vehicleId-г NOT NULL болгох.
--   6. Хуучин attr баганууд + unique(accountId,plate)-ийг арилгах.
--   7. FK + unique(accountId,vehicleId) + index нэмэх.

-- 1) vehicleId багана -------------------------------------------------------
ALTER TABLE "AccountVehicle" ADD COLUMN "vehicleId" TEXT;

-- 2a) VIN-ээр тааруулах ------------------------------------------------------
UPDATE "AccountVehicle" av SET "vehicleId" = v.id
FROM "Vehicle" v
WHERE av."vehicleId" IS NULL
  AND av."vin" IS NOT NULL AND btrim(av."vin") <> ''
  AND v."vin" IS NOT NULL
  AND upper(btrim(v."vin")) = upper(btrim(av."vin"));

-- 2b) plate-ээр тааруулах ----------------------------------------------------
UPDATE "AccountVehicle" av SET "vehicleId" = v.id
FROM "Vehicle" v
WHERE av."vehicleId" IS NULL
  AND upper(btrim(v."plate")) = upper(btrim(av."plate"));

-- 3) Тааараагүй AccountVehicle-д шинэ global Vehicle (key-ээр нэгтгэж) --------
CREATE TEMP TABLE _av_new AS
WITH unmatched AS (
  SELECT * FROM "AccountVehicle" WHERE "vehicleId" IS NULL
),
keyed AS (
  SELECT *,
         CASE WHEN "vin" IS NOT NULL AND btrim("vin") <> ''
              THEN 'VIN:' || upper(btrim("vin"))
              ELSE 'PLATE:' || upper(btrim("plate")) END AS k
  FROM unmatched
),
canon AS (
  SELECT DISTINCT ON (k) k, id AS seed_id
  FROM keyed ORDER BY k, "updatedAt" DESC, id
)
SELECT keyed.id AS av_id,
       'avseed-' || canon.seed_id AS vehicle_id,
       (keyed.id = canon.seed_id) AS is_seed,
       keyed."plate", keyed."vin", keyed."make", keyed."model", keyed."year",
       keyed."fuelType", keyed."wheelPosition", keyed."mileage",
       keyed."createdAt", keyed."updatedAt"
FROM keyed JOIN canon ON keyed.k = canon.k;

INSERT INTO "Vehicle" (id, plate, vin, make, model, year, "fuelType", "wheelPosition", mileage, "createdAt", "updatedAt")
SELECT vehicle_id, upper(btrim("plate")), NULLIF(upper(btrim("vin")), ''),
       "make", "model", "year", "fuelType", "wheelPosition", "mileage",
       "createdAt", "updatedAt"
FROM _av_new WHERE is_seed;

UPDATE "AccountVehicle" av SET "vehicleId" = m.vehicle_id
FROM _av_new m WHERE av.id = m.av_id AND av."vehicleId" IS NULL;

-- 4) Нэг (accountId, vehicleId)-д давхар AccountVehicle нэгтгэх ---------------
CREATE TEMP TABLE _av_dedup AS
WITH ranked AS (
  SELECT id, "accountId", "vehicleId",
         first_value(id) OVER (
           PARTITION BY "accountId", "vehicleId"
           ORDER BY "createdAt" ASC, id
         ) AS survivor_id
  FROM "AccountVehicle"
)
SELECT id AS dup_id, survivor_id FROM ranked WHERE id <> survivor_id;

UPDATE "Appointment" ap SET "accountVehicleId" = d.survivor_id
FROM _av_dedup d WHERE ap."accountVehicleId" = d.dup_id;

DELETE FROM "AccountVehicle" WHERE id IN (SELECT dup_id FROM _av_dedup);

-- 5) vehicleId NOT NULL ------------------------------------------------------
ALTER TABLE "AccountVehicle" ALTER COLUMN "vehicleId" SET NOT NULL;

-- 6) Хуучин attr баганууд + unique(accountId,plate) арилгах ------------------
DROP INDEX "AccountVehicle_accountId_plate_key";
ALTER TABLE "AccountVehicle"
  DROP COLUMN "plate",
  DROP COLUMN "vin",
  DROP COLUMN "make",
  DROP COLUMN "model",
  DROP COLUMN "year",
  DROP COLUMN "fuelType",
  DROP COLUMN "wheelPosition",
  DROP COLUMN "mileage";

-- 7) FK + unique + index -----------------------------------------------------
CREATE UNIQUE INDEX "AccountVehicle_accountId_vehicleId_key" ON "AccountVehicle"("accountId", "vehicleId");
CREATE INDEX "AccountVehicle_vehicleId_idx" ON "AccountVehicle"("vehicleId");
ALTER TABLE "AccountVehicle" ADD CONSTRAINT "AccountVehicle_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
