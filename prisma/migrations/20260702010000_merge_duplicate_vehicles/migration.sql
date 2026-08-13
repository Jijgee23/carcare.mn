-- Давхардсан global Vehicle бичлэгүүдийг нэгтгэнэ.
--
-- Шалтгаан: улсын дугаарын нормчлол сул байсан тул нэг машин бичилтийн
-- хувилбараар ("1234ABC" латин vs "1234АВС" кирилл, зайтай/зайгүй) хэд хэдэн
-- Vehicle болж үүссэн байж болно. lib/vehicles.ts normalizePlate одоо латин
-- төстэй үсгийг кирилл болгож, зай/тэмдэгт хасдаг болсон — энэ миграц одоо
-- байгаа өгөгдлийг мөн тэр канонд оруулж давхардлыг нэгтгэнэ.
--
-- Канон сонголт: VIN-тэй нь тэргүүлнэ, дараа нь хамгийн эрт үүссэн нь.
-- "#OLD-" tombstone дугаартай (дугаар нь шилжсэн) машиныг хөндөхгүй.

-- 1) Нормчилсон дугаар
CREATE TEMP TABLE veh_norm AS
SELECT id,
       translate(
         upper(regexp_replace(plate, '[^0-9A-Za-zА-Яа-яЁёӨөҮү]', '', 'g')),
         'ABCEHKMOPTXY',
         'АВСЕНКМОРТХУ'
       ) AS norm
FROM "Vehicle"
WHERE plate NOT LIKE '%#OLD-%';

-- 2) Групп бүрийн канон (VIN-тэй → хамгийн хуучин)
CREATE TEMP TABLE veh_canon AS
SELECT DISTINCT ON (n.norm) n.id, n.norm
FROM veh_norm n
JOIN "Vehicle" v ON v.id = n.id
ORDER BY n.norm, (v.vin IS NULL), v."createdAt";

-- 3) Давхардал → канон буулгалт
CREATE TEMP TABLE veh_map AS
SELECT n.id AS dup_id, c.id AS canon_id
FROM veh_norm n
JOIN veh_canon c ON c.norm = n.norm
WHERE n.id <> c.id;

-- 4) Appointment.accountVehicleId — канон холбоос байвал түүн рүү шилжүүлнэ
UPDATE "Appointment" a
SET "accountVehicleId" = av2.id
FROM "AccountVehicle" av
JOIN veh_map m ON av."vehicleId" = m.dup_id
JOIN "AccountVehicle" av2
  ON av2."accountId" = av."accountId" AND av2."vehicleId" = m.canon_id
WHERE a."accountVehicleId" = av.id;

-- 5) AccountVehicle — канон холбоос давхар байвал давхардлыг устгаж,
--    үлдсэнийг канон Vehicle рүү заалгана
DELETE FROM "AccountVehicle" av
USING veh_map m, "AccountVehicle" av2
WHERE av."vehicleId" = m.dup_id
  AND av2."accountId" = av."accountId"
  AND av2."vehicleId" = m.canon_id;

UPDATE "AccountVehicle" av
SET "vehicleId" = m.canon_id
FROM veh_map m
WHERE av."vehicleId" = m.dup_id;

-- 6) TenantVehicle — мөн адил (нэг tenant-д нэг машин нэг л link)
DELETE FROM "TenantVehicle" tv
USING veh_map m, "TenantVehicle" tv2
WHERE tv."vehicleId" = m.dup_id
  AND tv2."tenantId" = tv."tenantId"
  AND tv2."vehicleId" = m.canon_id;

UPDATE "TenantVehicle" tv
SET "vehicleId" = m.canon_id
FROM veh_map m
WHERE tv."vehicleId" = m.dup_id;

-- 7) Захиалга / оношилгоо / цаг захиалгын заалтуудыг канон руу
UPDATE "ServiceOrder" so
SET "vehicleId" = m.canon_id
FROM veh_map m
WHERE so."vehicleId" = m.dup_id;

UPDATE "DiagnosticReport" dr
SET "vehicleId" = m.canon_id
FROM veh_map m
WHERE dr."vehicleId" = m.dup_id;

UPDATE "Appointment" a
SET "vehicleId" = m.canon_id
FROM veh_map m
WHERE a."vehicleId" = m.dup_id;

-- 8) Канонд VIN байхгүй, давхардалд байвал шилжүүлнэ (unique тул эхлээд
--    давхардлаас чөлөөлж, устгасны дараа канонд онооно)
CREATE TEMP TABLE vin_move AS
SELECT m.canon_id, d.vin
FROM veh_map m
JOIN "Vehicle" d ON d.id = m.dup_id
JOIN "Vehicle" c ON c.id = m.canon_id
WHERE c.vin IS NULL AND d.vin IS NOT NULL;

-- 9) Давхардсан Vehicle-үүдийг устгана
DELETE FROM "Vehicle" WHERE id IN (SELECT dup_id FROM veh_map);

UPDATE "Vehicle" c
SET vin = vm.vin
FROM vin_move vm
WHERE c.id = vm.canon_id;

-- 10) Үлдсэн машинуудын дугаарыг канон бичилтэд оруулна (мөргөлдөөнгүй үед л)
UPDATE "Vehicle" v
SET plate = n.norm
FROM veh_norm n
WHERE v.id = n.id
  AND v.plate <> n.norm
  AND NOT EXISTS (
    SELECT 1 FROM "Vehicle" x WHERE x.plate = n.norm AND x.id <> v.id
  );
