-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Appointment_status_requestedAt_reminderSentAt_idx" ON "Appointment"("status", "requestedAt", "reminderSentAt");
