-- CreateEnum
CREATE TYPE "SubscriptionPaymentMethod" AS ENUM ('QPAY', 'BANK_TRANSFER', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "SubscriptionPaymentStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'FAILED');

-- CreateTable
CREATE TABLE "QPaySettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "invoiceCode" TEXT NOT NULL,
    "callbackUrl" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QPaySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "period" "BillingPeriod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MNT',
    "planPriceId" TEXT,
    "method" "SubscriptionPaymentMethod" NOT NULL DEFAULT 'QPAY',
    "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "qpayInvoiceId" TEXT,
    "qpayPaymentId" TEXT,
    "qrImage" TEXT,
    "qrText" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_createdSubscriptionId_key" ON "SubscriptionPayment"("createdSubscriptionId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_tenantId_status_idx" ON "SubscriptionPayment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_qpayInvoiceId_idx" ON "SubscriptionPayment"("qpayInvoiceId");

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_planPriceId_fkey" FOREIGN KEY ("planPriceId") REFERENCES "PlanPrice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
