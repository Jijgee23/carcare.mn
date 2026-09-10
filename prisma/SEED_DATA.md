# CarService seed data

`npm run db:seed` loads the address reference data and a deterministic
Mongolia-focused fixture dataset. It does not wipe the database. The seeded
rows use stable `seed-` IDs and unique fixture identifiers, so rerunning the
seed updates the fixtures instead of multiplying them.

The fixture set includes:

- 4 organizations: Ulaanbaatar, Darkhan-Uul, and Orkhon branches
- 9 branches with weekday schedules, a holiday exception, a shortened special
  day, and a winter seasonal schedule
- 12 staff users and roles, plus a super-admin
- 24 customer accounts, 76 tenant customer records, and 24 HUR-like vehicles
- tenant vehicle links, plate history, postpaid vehicle examples, and
  cross-tenant customer relationships
- service categories, branch duration overrides, labor/diagnostic/goods
  catalog entries, units, stock values, and inactive catalog data
- 150 service orders across every order status and payment state, with a dense
  96-order schedule for the first tenant
- 192 appointments across every appointment status, including linked orders,
  with a dense 120-appointment schedule for the first tenant,
  multiple categories, and appointment fees/payments
- diagnostic templates and reports with schema answers, severity, notes,
  inspection-photo and signature URLs
- order payments, subscription plans/prices/limits/features, devices,
  sessions, refresh tokens, OTPs, notifications, feedback, and audit logs

If the previous legacy fixture was already loaded, reset the development
database before running this version. The seed never deletes the old rows, and
the renamed `seed-` identifiers are intentionally a new fixture namespace.

## Test credentials

Worker users and the super-admin use the password `CarServiceTest123!`.

- Worker owner: `owner1@carservice.mn` through `owner4@carservice.mn`
- Super-admin: `superadmin@carservice.mn`
- Customer account phones: `99110001` through `99110024` (customer OTP should
  be requested through the normal customer login flow)

The password and all QPay values are development-only placeholders. Do not
load this fixture into a production database. The seed refuses to run when
`NODE_ENV=production` unless `SEED_FIXTURE_DATA=true` is set explicitly.
