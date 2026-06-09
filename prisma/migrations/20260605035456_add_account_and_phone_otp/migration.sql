-- AlterEnum
ALTER TYPE "OtpType" ADD VALUE 'CONSUMER_LOGIN';

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "accountId" TEXT;

-- AlterTable
ALTER TABLE "Otp" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "phone" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_phone_key" ON "Account"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_tenantId_accountId_key" ON "Customer"("tenantId", "accountId");

-- CreateIndex
CREATE INDEX "Otp_phone_type_idx" ON "Otp"("phone", "type");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
