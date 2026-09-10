-- Rename OrderStatus enum value WAITING_PARTS -> POSTPONED (COWORK.md, 2026-09-10).
-- "Waiting for parts" implied a single reason for pausing work; POSTPONED
-- covers any reason. This status also drops the occupied/released ambiguity
-- it used to have in the app layer (see the UI/action changes in the same
-- commit) — a postponed order is now always released, no toggle. ALTER TYPE
-- ... RENAME VALUE is atomic and rewrites nothing: every existing
-- ServiceOrder row keeps its data, only the enum label changes.
ALTER TYPE "OrderStatus" RENAME VALUE 'WAITING_PARTS' TO 'POSTPONED';
