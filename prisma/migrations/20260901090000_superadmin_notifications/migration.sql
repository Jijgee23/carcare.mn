-- SuperAdmin-д push төхөөрөмж/мэдэгдэл бүртгэх боломж нэмэх — Device/Notification-ийн
-- 2 талт XOR (userId/accountId)-ийг 3 талт (+ superAdminId) болгоно.

-- Device --------------------------------------------------------------------
ALTER TABLE "Device" ADD COLUMN "superAdminId" TEXT;
CREATE INDEX "Device_superAdminId_idx" ON "Device"("superAdminId");
ALTER TABLE "Device" ADD CONSTRAINT "Device_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES "SuperAdmin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Device" DROP CONSTRAINT "device_owner_xor";
ALTER TABLE "Device" ADD CONSTRAINT "device_owner_xor" CHECK ((("userId" IS NOT NULL)::int + ("accountId" IS NOT NULL)::int + ("superAdminId" IS NOT NULL)::int) = 1);

-- Notification ----------------------------------------------------------------
ALTER TABLE "Notification" ADD COLUMN "superAdminId" TEXT;
CREATE INDEX "Notification_superAdminId_readAt_idx" ON "Notification"("superAdminId", "readAt");
CREATE INDEX "Notification_superAdminId_createdAt_idx" ON "Notification"("superAdminId", "createdAt" DESC);
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES "SuperAdmin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" DROP CONSTRAINT "notification_owner_xor";
ALTER TABLE "Notification" ADD CONSTRAINT "notification_owner_xor" CHECK ((("userId" IS NOT NULL)::int + ("accountId" IS NOT NULL)::int + ("superAdminId" IS NOT NULL)::int) = 1);
