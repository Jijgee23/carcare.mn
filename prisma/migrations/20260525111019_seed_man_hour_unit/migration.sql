-- Системийн default `хүн/цаг` нэгжийг тенант бүрд (хэрвээ байхгүй бол) нэмнэ.
INSERT INTO "Unit" ("id", "name", "code", "isActive", "tenantId", "createdAt", "updatedAt")
SELECT
  'unit_' || md5(t."id" || '-хүн/цаг') AS "id",
  'хүн/цаг' AS "name",
  'х/ц' AS "code",
  TRUE AS "isActive",
  t."id" AS "tenantId",
  NOW() AS "createdAt",
  NOW() AS "updatedAt"
FROM "Tenant" t
ON CONFLICT ("tenantId", "name") DO NOTHING;
