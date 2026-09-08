-- DataMigration
-- Шинэ "orders.itemStatus" тусгай эрхийг нэмэв (харах: lib/auth/permissions.ts) —
-- засварын хуудасны ажил/оношилгоо/сэлбэг мөрийн явц өөрчлөх нь цаашид
-- "orders.edit"-ээс тусдаа эрхээр хамгаалагдана. Өмнө нь "orders.edit"-тэй
-- байсан бол мөрийн явц чөлөөтэй өөрчилдөг байсан тул одоо байгаа Role
-- бүрд шинэ эрхийг автоматаар нэмж, ажилтны боломж гэнэт хумигдахаас
-- сэргийлнэ (шинэ Role-д зөвхөн шинээр сонгосон тохиолдолд орно).
UPDATE "Role"
SET "permissions" = array_append("permissions", 'orders.itemStatus')
WHERE 'orders.edit' = ANY("permissions")
  AND NOT ('orders.itemStatus' = ANY("permissions"));
