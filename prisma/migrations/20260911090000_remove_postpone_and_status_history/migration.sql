-- Fully remove the "хойшлуулах" (postpone) feature and the structured
-- OrderStatusChange status-history table (product decision: the repair
-- order page keeps only ServiceOrder.startedAt/completedAt — no dedicated
-- change log). AuditLog is untouched; it already records STATUS_CHANGE
-- generically and was never postpone-specific.

-- Step 1: data fixup — any order still POSTPONED is resumed to IN_PROGRESS,
-- mirroring exactly what the app's own resume path (POSTPONED -> IN_PROGRESS
-- in changeOrderStatusAction) already did at the DB level: close whatever
-- booking is open for the order and open a fresh ACTIVE row anchored to now.
-- Must run BEFORE the enum swap below, since that swap's USING cast fails on
-- any row still literally 'POSTPONED'.
WITH postponed_orders AS (
  SELECT id, "tenantId", "branchId" FROM "ServiceOrder" WHERE status = 'POSTPONED'
),
closed AS (
  UPDATE "OrderTimeBooking" b
  SET "closedAt" = now(), "endAt" = now()
  WHERE b."closedAt" IS NULL
    AND b."orderId" IN (SELECT id FROM postponed_orders)
  RETURNING b."orderId"
)
INSERT INTO "OrderTimeBooking" (id, "tenantId", "orderId", "branchId", kind, "startAt", "endAt", "closedAt", "createdById", "createdAt")
SELECT gen_random_uuid()::text, o."tenantId", o.id, o."branchId", 'ACTIVE', now(), NULL, NULL, NULL, now()
FROM postponed_orders o;

UPDATE "ServiceOrder"
SET status = 'IN_PROGRESS', "occupiesCapacity" = true
WHERE status = 'POSTPONED';

-- Step 2: drop the status-history table (its policy/FKs go with it).
DROP TABLE "OrderStatusChange";

-- Step 3: drop the postpone-reason-tag enum (must follow the table drop —
-- it was the type of that table's "reasonTag" column).
DROP TYPE "OrderPostponeReasonTag";

-- Step 4: recreate OrderStatus without POSTPONED. Postgres has no
-- ALTER TYPE ... DROP VALUE, so swap the column to a freshly-defined type.
CREATE TYPE "OrderStatus_new" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
ALTER TABLE "ServiceOrder" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ServiceOrder" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TABLE "ServiceOrder" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';
DROP TYPE "OrderStatus";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
