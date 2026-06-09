-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_accountId_fkey";

-- AlterTable
ALTER TABLE "Appointment" ALTER COLUMN "accountId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
