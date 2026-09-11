-- S18: enforce "at most one open (closedAt IS NULL) OrderTimeBooking row per
-- (orderId, kind)" at the DB level. Confirmed by audit (2026-09-11): 155 total
-- rows, 75 open, zero existing violations at time of writing — safe to add.
--
-- Postgres partial unique index (Prisma schema DSL can't express the WHERE
-- clause, so this constraint lives in raw SQL only; schema.prisma's
-- OrderTimeBooking model keeps its existing @@index block unchanged, with an
-- updated doc comment noting the DB now also enforces this).
CREATE UNIQUE INDEX "OrderTimeBooking_orderId_kind_open_key"
  ON "OrderTimeBooking" ("orderId", "kind")
  WHERE "closedAt" IS NULL;
