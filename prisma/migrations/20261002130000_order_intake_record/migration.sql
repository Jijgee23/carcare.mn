-- QA #14: who/when recorded the intake + customer signature; photo paths unique.
ALTER TABLE "ServiceOrder"
  ADD COLUMN IF NOT EXISTS "intakeRecordedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "intakeRecordedById" TEXT,
  ADD COLUMN IF NOT EXISTS "intakeSignaturePath" TEXT;

ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_intakeRecordedById_fkey" FOREIGN KEY ("intakeRecordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "ServiceOrderIntakePhoto_path_key" ON "ServiceOrderIntakePhoto"("path");
