-- QA #14: order intake notes + photos.
ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "intakeNotes" TEXT;

CREATE TABLE IF NOT EXISTS "ServiceOrderIntakePhoto" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceOrderIntakePhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ServiceOrderIntakePhoto_orderId_idx" ON "ServiceOrderIntakePhoto"("orderId");
CREATE INDEX IF NOT EXISTS "ServiceOrderIntakePhoto_tenantId_idx" ON "ServiceOrderIntakePhoto"("tenantId");

ALTER TABLE "ServiceOrderIntakePhoto" ADD CONSTRAINT "ServiceOrderIntakePhoto_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
