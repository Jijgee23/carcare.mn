-- Хуучин placeholder нэрсийг хоосон болгоно. Нэр байхгүй үед дэлгэцэнд утсаар
-- нь харуулдаг болсон (lib/customers.ts customerLabel) тул эдгээр текст хэрэггүй.
UPDATE "Customer"
SET "fullName" = ''
WHERE "fullName" IN ('Цаг захиалсан хэрэглэгч', 'Цаг захиалсан үйлчлүүлэгч', 'Нэргүй');
