-- Систем key-г заавал болгохын өмнө: одоо байгаа БҮХ тенантын Category
-- мөрд "Ерөнхий" нэртэй default систем түлхүүр үүсгэж оноож backfill хийнэ
-- (харах: prisma/schema.prisma-ийн Category.systemServiceKeyId comment).
--
-- RLS bypass шаардлагатай — энэ backfill бүх тенантын Category мөрд
-- хамаарна, харин non-superuser DB role (prod/carcare_local) дээр
-- app.bypass_rls тавихгүй бол FORCE ROW LEVEL SECURITY-ийн улмаас UPDATE
-- ЗӨВХӨН 0 мөрд чимээгүй таарч, "амжилттай" гэж мэдээлдэг (харах:
-- rls-tenant-isolation тэмдэглэлийн "Тав дахь давтагдах хэлбэр").
SET LOCAL app.bypass_rls = 'on';

INSERT INTO "SystemServiceKey" (id, name, description, "isActive", "createdAt", "updatedAt")
VALUES (
  'svckey_general',
  'Ерөнхий',
  'Тодорхой систем ангилалд ороогүй үйлчилгээнд зориулсан ерөнхий түлхүүр.',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (name) DO NOTHING;

UPDATE "Category"
SET "systemServiceKeyId" = (SELECT id FROM "SystemServiceKey" WHERE name = 'Ерөнхий')
WHERE "systemServiceKeyId" IS NULL;

-- AlterTable: одоо бүх мөр утгатай тул заавал (NOT NULL) болгож болно.
ALTER TABLE "Category" ALTER COLUMN "systemServiceKeyId" SET NOT NULL;

-- NOT NULL багана дээр "ON DELETE SET NULL" хийх боломжгүй тул RESTRICT
-- болгоно — ашиглагдаж буй түлхүүрийг DB түвшинд ч устгахыг хориглоно
-- (app-level хамгаалалт: app/_actions/system-service-keys.ts-ийн
-- archive-if-used аль хэдийн байгаа).
ALTER TABLE "Category" DROP CONSTRAINT "Category_systemServiceKeyId_fkey";
ALTER TABLE "Category" ADD CONSTRAINT "Category_systemServiceKeyId_fkey" FOREIGN KEY ("systemServiceKeyId") REFERENCES "SystemServiceKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
