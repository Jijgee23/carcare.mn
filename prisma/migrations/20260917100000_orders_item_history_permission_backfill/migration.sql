-- DataMigration
-- Шинэ "orders.itemHistory" тусгай эрхийг нэмэв (харах: lib/auth/permissions.ts) —
-- засварын хуудасны цуцлагдсан ажил/оношилгоо/сэлбэг мөрийн түүхийг харах нь
-- цаашид энэ тусдаа эрхээр хамгаалагдана. Өмнө нь "orders.edit"-тэй хэн ч
-- цуцлагдсан мөрийг (шууд жагсаалтад) харж байсан тул одоо байгаа Role
-- бүрд шинэ эрхийг автоматаар нэмж, ажилтны боломж гэнэт хумигдахаас
-- сэргийлнэ (шинэ Role-д зөвхөн шинээр сонгосон тохиолдолд орно).
UPDATE "Role"
SET "permissions" = array_append("permissions", 'orders.itemHistory')
WHERE 'orders.edit' = ANY("permissions")
  AND NOT ('orders.itemHistory' = ANY("permissions"));
