# Scheduling implementation status

2026-09-08: reservation persistence connected after the user confirmed the other
developer migrated the shared DB. Local client regenerated; NO migration run here.

## Latest completed stage

- All three appointment creation paths (mobile API, account web, staff phone-in)
  use `reserveAppointment`: branch row lock, category/ownership validation,
  duration resolution, hours/grid/future-time check, capacity read, and insert
  on one raw Prisma transaction connection with explicit request RLS settings.
- Saved duration is written at creation and selected by both availability paths
  and the submission capacity check. Legacy null snapshots retain the old inferred
  fallback; no historical backfill was performed.
- Booking slot timestamps/day boundaries use Asia/Ulaanbaatar (+08 for future
  online slots), independently of the host timezone. Impossible dates are rejected.
- Invalid category selections now return a validation error rather than silently
  dropping services. Existing API response payload shapes are preserved.
- Production build and focused lint passed; 31 fixture tests passed. Full lint
  retains the existing 29 errors / 18 warnings.
- `scripts/check-booking-transaction.ts` passed against the shared DB: all five
  columns exist, connection identity and tenant flags persist, private advisory
  lock survives multiple queries and releases on completion, mismatched tenant
  context is rejected. No application rows were created/modified. This is not an
  end-to-end concurrent appointment insertion test; real customer/fee flows were
  not executed against shared data.

Remaining: order timing/occupancy controls, live schedule loader and daily UI,
then customer timing payload/UI. The pure branch projection is still not wired
to live availability. Other app versions writing appointments without this helper
do not participate in its locking protocol; coordinate rollout of creation code.

## Earlier foundation (historical)

## Implemented

- `schedule-capacity.ts`: peak simultaneous occupancy for half-open intervals.
  Both `buildDaySlots` and `isSlotAvailable` now use this calculation. Consecutive
  jobs no longer incorrectly fill multiple places across a longer booking.
- `resolveTakenAppointmentIntervals` accepts optional saved estimates, preferring
  them to category settings. Existing queries do not select the new column yet,
  so snapshot persistence/read integration remains pending migration.
- `branch-schedule.ts`: pure branch-scoped projection for reservations and orders,
  linked-record deduplication, walk-ins, explicit release, and uncertainty issues.
  This module is not yet connected to database queries, UI, or live availability.
- `npm run test:scheduling`: isolated Node/tsx regression tests, no database.

## Projection contract

The future loader must fetch tenant/branch-scoped appointments plus all linked
orders (including completed/released ones) and all current active/occupied orders,
including carry-over jobs from earlier days. Filtering only by today's scheduledAt
would omit occupying cars. The pure function additionally filters tenant/branch
scope defensively; this does not replace database authorization.

One linked appointment/order consumes one place. Explicitly released active work
consumes none; scheduled orders reserve their planned interval even before arrival.
Completed/cancelled orders still consume capacity when occupancy is explicitly true.
Legacy terminal orders with null occupancy are omitted; live rollout needs staff
reconciliation of physically present cars. Unknown active occupancy, missing
forecasts, and overdue occupied orders conservatively extend to the query horizon
with issues. This is an uncertainty bound, not a promised customer finish time.
The UI must expose these issues and require staff reconciliation.

## Next, after migration owner returns schema and exact migration

1. Merge the migration history and regenerate the client after DB confirmation.
2. Wire saved estimates into all booking creation and availability query paths.
   Existing legacy fallback currently recalculates from categories; do not claim
   that historical estimates are frozen before this step is implemented.
3. Make reservation validation + insert atomic across every entry point; validate
   hours, timezone and full duration in the same transaction. Inspect the RLS
   wrapper in `lib/prisma.ts`: it wraps each query in its own transaction on the
   base client. Do not assume an outer transaction/lock automatically protects
   those queries; prove same-connection behavior and tenant scope with integration
   tests before shipping the reservation writer.
4. Add order estimate/occupancy actions and the tenant daily calendar. Integrate
   projection into availability with deduplication and stale-estimate handling.
5. Add optional customer timing fields and refresh/notification behavior.

No atomic reservation, new scheduling action, UI, or customer payload is shipped
by this foundation. It is compatible with the current pre-migration Prisma client.
