-- CreateEnum
CREATE TYPE "AppointmentPaymentStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'FAILED');

-- CreateTable
CREATE TABLE "AppointmentPayment" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MNT',
    "status" "AppointmentPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "qpayInvoiceId" TEXT,
    "qpayPaymentId" TEXT,
    "qrImage" TEXT,
    "qrText" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentPayment_appointmentId_key" ON "AppointmentPayment"("appointmentId");

-- CreateIndex
CREATE INDEX "AppointmentPayment_tenantId_status_idx" ON "AppointmentPayment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AppointmentPayment_accountId_status_idx" ON "AppointmentPayment"("accountId", "status");

-- CreateIndex
CREATE INDEX "AppointmentPayment_qpayInvoiceId_idx" ON "AppointmentPayment"("qpayInvoiceId");

-- AddForeignKey
ALTER TABLE "AppointmentPayment" ADD CONSTRAINT "AppointmentPayment_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentPayment" ADD CONSTRAINT "AppointmentPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentPayment" ADD CONSTRAINT "AppointmentPayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
