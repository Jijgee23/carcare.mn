-- Vehicle = "нэг эзэмшигчийн нэг машины бүртгэл". Машин зарагдахад шинэ эзэн
-- шинэ мөр бүртгэдэг тул plate/vin глобал давтагдашгүй байхаа болино.
-- Улсын дугаар бүртгэсний дараа солигдохгүй → VehiclePlateHistory хэрэггүй.

-- 1) Unique → энгийн индекс
DROP INDEX IF EXISTS "Vehicle_plate_key";
DROP INDEX IF EXISTS "Vehicle_vin_key";
CREATE INDEX IF NOT EXISTS "Vehicle_plate_idx" ON "Vehicle"("plate");
CREATE INDEX IF NOT EXISTS "Vehicle_vin_idx" ON "Vehicle"("vin");

-- 2) Хуучин tombstone ("1234УБА#OLD-xxxxxx") дугааруудыг жинхэнэ утгад нь
--    сэргээнэ — давхардал одоо зөвшөөрөгдөнө.
UPDATE "Vehicle"
SET "plate" = split_part("plate", '#OLD-', 1)
WHERE "plate" LIKE '%#OLD-%';

-- 3) Дугаарын түүхийн хүснэгт
DROP TABLE IF EXISTS "VehiclePlateHistory";
