-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "feeUnderpaidAmount" DECIMAL(12,2),
ADD COLUMN     "feeUnderpaidAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AppointmentPayment" ADD COLUMN     "paymentType" TEXT,
ADD COLUMN     "refundNote" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "refundedById" TEXT;

-- AddForeignKey
ALTER TABLE "AppointmentPayment" ADD CONSTRAINT "AppointmentPayment_refundedById_fkey" FOREIGN KEY ("refundedById") REFERENCES "SuperAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
