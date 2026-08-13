-- Tenant дотор ижил утастай "эзэнгүй" (accountId IS NULL, ажилтан гар аргаар
-- үүсгэсэн walk-in) Customer давхардлыг нэгтгэнэ. accountId-тэй (online Account-той
-- холбогдсон) Customer-уудыг ХӨНДӨХГҮЙ — нэг гэр бүлийн гишүүд ижил утсаар өөр
-- өөр Account-аар онлайн захиалга хийх нь хууль ёсны, давхардал биш тул.
--
-- Канон сонголт: хамгийн эрт үүссэн (createdAt) мөр.

CREATE TEMP TABLE cust_canon AS
SELECT DISTINCT ON (c."tenantId", c.phone) c.id, c."tenantId", c.phone
FROM "Customer" c
WHERE c."accountId" IS NULL
ORDER BY c."tenantId", c.phone, c."createdAt";

CREATE TEMP TABLE cust_map AS
SELECT c.id AS dup_id, canon.id AS canon_id
FROM "Customer" c
JOIN cust_canon canon
  ON canon."tenantId" = c."tenantId" AND canon.phone = c.phone
WHERE c."accountId" IS NULL
  AND c.id <> canon.id;

-- TenantVehicle.customerId (SetNull хамааралтай, unique зөрчилгүй)
UPDATE "TenantVehicle" tv
SET "customerId" = m.canon_id
FROM cust_map m
WHERE tv."customerId" = m.dup_id;

-- ServiceOrder.customerId (Restrict, заавал)
UPDATE "ServiceOrder" so
SET "customerId" = m.canon_id
FROM cust_map m
WHERE so."customerId" = m.dup_id;

-- DiagnosticReport.customerId (Restrict, заавал)
UPDATE "DiagnosticReport" dr
SET "customerId" = m.canon_id
FROM cust_map m
WHERE dr."customerId" = m.dup_id;

-- Appointment.customerId (SetNull, заавал биш)
UPDATE "Appointment" a
SET "customerId" = m.canon_id
FROM cust_map m
WHERE a."customerId" = m.dup_id;

-- Давхардсан walk-in Customer мөрүүдийг устгана
DELETE FROM "Customer" WHERE id IN (SELECT dup_id FROM cust_map);

-- "Эзэнгүй" (accountId IS NULL) Customer-уудын дунд tenant+phone давхардахгүй
-- байхыг баталгаажуулна. accountId-тэй мөрүүд энэ индексэд ороогүй тул
-- олон Account ижил утас ашиглах хууль ёсны тохиолдлыг блоклохгүй.
-- (Prisma schema DSL-д partial/filtered unique index илэрхийлэх боломжгүй тул
-- зөвхөн миграцад гараар нэмнэ — Device-ийн XOR CHECK-тэй адил загвар.)
CREATE UNIQUE INDEX "Customer_tenantId_phone_unclaimed_key"
  ON "Customer"("tenantId", phone)
  WHERE "accountId" IS NULL;
