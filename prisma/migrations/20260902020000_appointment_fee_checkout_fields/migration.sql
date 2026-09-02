-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "feeAmount" DECIMAL(12,2),
ADD COLUMN     "feeCurrency" TEXT,
ADD COLUMN     "feeQpayInvoiceId" TEXT,
ADD COLUMN     "feeQrImage" TEXT,
ADD COLUMN     "feeQrText" TEXT;

-- Data migration: AppointmentPayment одоо ЗӨВХӨН төлөгдсөн (PAID) Invoice
-- хадгална. Хуучин архитектурт (энэ migration-аас өмнө) захиалга үүсэх/
-- баталгаажих үед шууд PENDING мөр үүсгэдэг байсан — тэдгээрийг Appointment-
-- ийн шинэ fee* талбар руу нүүлгэж, PAID биш мөрүүдийг устгана.
UPDATE "Appointment" a
SET "feeAmount" = ap."amount",
    "feeCurrency" = ap."currency",
    "feeQpayInvoiceId" = ap."qpayInvoiceId",
    "feeQrImage" = ap."qrImage",
    "feeQrText" = ap."qrText"
FROM "AppointmentPayment" ap
WHERE a."id" = ap."appointmentId" AND ap."status" != 'PAID';

DELETE FROM "AppointmentPayment" WHERE "status" != 'PAID';
