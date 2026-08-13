-- Хүлээн авагч яг нэг байх (XOR): userId эсвэл accountId-ийн аль нэг нь л утгатай.
-- Notification-ийн notification_owner_xor-той адил загвар.
ALTER TABLE "Device" ADD CONSTRAINT "device_owner_xor" CHECK ((("userId" IS NOT NULL)::int + ("accountId" IS NOT NULL)::int) = 1);
