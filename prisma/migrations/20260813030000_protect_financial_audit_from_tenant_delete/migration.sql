-- Санхүү/аудитын өгөгдлийг Tenant hard-delete-ийн Cascade-ээс хамгаална.
-- OrderPayment нь Tenant руу хоёр замаар холбогддог (шууд tenantId, мөн
-- orderId -> ServiceOrder -> tenantId) тул диаманд cascade-ийн эрсдэлээс
-- сэргийлж хоёуланг нь Restrict болгоно (зөвхөн tenantId Restrict хийвэл
-- ServiceOrder cascade-ийн замаар яг адилхан устаж болзошгүй).

-- AuditLog
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_tenantId_fkey";
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SubscriptionPayment
ALTER TABLE "SubscriptionPayment" DROP CONSTRAINT "SubscriptionPayment_tenantId_fkey";
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- OrderPayment (tenantId + orderId хоёуланг нь)
ALTER TABLE "OrderPayment" DROP CONSTRAINT "OrderPayment_tenantId_fkey";
ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderPayment" DROP CONSTRAINT "OrderPayment_orderId_fkey";
ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
