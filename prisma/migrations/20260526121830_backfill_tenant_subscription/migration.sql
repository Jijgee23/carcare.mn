-- Тенант бүрт subscription мөр баталгаатай байх — одоо байгаа тенантуудаас
-- subscription огт байхгүй бичлэгтэй бол 14 хоногийн TRIAL автоматаар нэмнэ.
-- Tenant.plan-аас plan-ыг өвлүүлнэ; trial эхлэх огноо = одоо, дуусах = 14 хоног дараа.

INSERT INTO "Subscription" (
  "id", "plan", "status", "startsAt", "endsAt",
  "tenantId", "notes", "createdAt", "updatedAt"
)
SELECT
  'sub_' || md5(t."id" || '-backfill') AS "id",
  t."plan",
  'TRIAL'::"SubscriptionStatus" AS "status",
  NOW() AS "startsAt",
  NOW() + INTERVAL '14 days' AS "endsAt",
  t."id" AS "tenantId",
  'Хуучин тенантад автоматаар нэмсэн 14 хоногийн туршилт.' AS "notes",
  NOW() AS "createdAt",
  NOW() AS "updatedAt"
FROM "Tenant" t
WHERE NOT EXISTS (
  SELECT 1 FROM "Subscription" s WHERE s."tenantId" = t."id"
);
