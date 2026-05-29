-- Шилжүүлэг: Service.unit (String) → Service.unitId (FK Unit)
--             Service.durationMin (Int) → Service.durationValue + Service.durationUnitId

-- 1) Шинэ колумнуудыг nullable-р нэмнэ
ALTER TABLE "Service" ADD COLUMN "unitId"         TEXT;
ALTER TABLE "Service" ADD COLUMN "durationValue"  DECIMAL(12,3);
ALTER TABLE "Service" ADD COLUMN "durationUnitId" TEXT;

-- 2) Тенант бүрд default Unit-уудыг (хэрвээ байхгүй бол) бичнэ.
--    Үндсэн нэгжүүд: ширхэг, цаг, мин, литр, кг, м, удаа, багц
INSERT INTO "Unit" ("id", "name", "code", "isActive", "tenantId", "createdAt", "updatedAt")
SELECT
  -- Postgres random id (cuid биш ч аюулгүй)
  'unit_' || md5(t."id" || '-' || u."name") AS id,
  u."name",
  u."code",
  TRUE AS "isActive",
  t."id" AS "tenantId",
  NOW() AS "createdAt",
  NOW() AS "updatedAt"
FROM "Tenant" t
CROSS JOIN (
  VALUES
    ('ширхэг', 'ш'),
    ('цаг',    'ц'),
    ('мин',    'мин'),
    ('литр',   'л'),
    ('кг',     'кг'),
    ('м',      'м'),
    ('удаа',   NULL),
    ('багц',   NULL)
) AS u("name", "code")
ON CONFLICT ("tenantId", "name") DO NOTHING;

-- 3) Хуучин `unit` string-аас (тенант + name)-р match хийж Service.unitId-г оноо
UPDATE "Service" s
SET "unitId" = u."id"
FROM "Unit" u
WHERE u."tenantId" = s."tenantId"
  AND u."name" = s."unit";

-- 4) Match-гүй үлдсэн Service-ийн "unit" string-ийг шинэ Unit болгож үүсгээд id-г оноо
INSERT INTO "Unit" ("id", "name", "code", "isActive", "tenantId", "createdAt", "updatedAt")
SELECT DISTINCT
  'unit_' || md5(s."tenantId" || '-' || s."unit") AS "id",
  s."unit" AS "name",
  NULL AS "code",
  TRUE AS "isActive",
  s."tenantId",
  NOW(),
  NOW()
FROM "Service" s
WHERE s."unitId" IS NULL
  AND s."unit" IS NOT NULL
  AND s."unit" <> ''
ON CONFLICT ("tenantId", "name") DO NOTHING;

UPDATE "Service" s
SET "unitId" = u."id"
FROM "Unit" u
WHERE s."unitId" IS NULL
  AND u."tenantId" = s."tenantId"
  AND u."name" = s."unit";

-- 5) durationMin (минут) → durationValue + durationUnitId = "мин"
UPDATE "Service" s
SET "durationValue" = s."durationMin"::DECIMAL,
    "durationUnitId" = u."id"
FROM "Unit" u
WHERE s."durationMin" IS NOT NULL
  AND u."tenantId" = s."tenantId"
  AND u."name" = 'мин';

-- 6) Хуучин колумнуудыг хасна
ALTER TABLE "Service" DROP COLUMN "unit";
ALTER TABLE "Service" DROP COLUMN "durationMin";

-- 7) Index, foreign key constraint
CREATE INDEX "Service_unitId_idx" ON "Service"("unitId");
CREATE INDEX "Service_durationUnitId_idx" ON "Service"("durationUnitId");

ALTER TABLE "Service" ADD CONSTRAINT "Service_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Service" ADD CONSTRAINT "Service_durationUnitId_fkey"
  FOREIGN KEY ("durationUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
