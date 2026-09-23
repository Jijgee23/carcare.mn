import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { before, test } from "node:test";
import type { ApiUser } from "../lib/auth/api-token";

// P3-B5 — customer order history and vehicle service history.
//
// `lib/vehicles/vehicle-history.ts` and `lib/customers/customer-history.ts`
// are plain, Prisma-importing but non-`server-only` modules — `prisma.ts`
// itself does env validation at import time but does not import
// `server-only`, so these two are importable under `tsx --test` the same
// way `lib/customers/customer-commands.ts` is in the sibling detail-route
// test file. The two route files
// (`app/api/v1/customers/[id]/history/route.ts`,
// `app/api/v1/vehicles/[id]/history/route.ts`) transitively pull in
// `lib/api.ts` -> ... -> `server-only` the same way the sibling detail
// routes do, so — matching those files' documented gap — route behaviour is
// covered structurally (source-pattern assertions, labelled below) rather
// than by importing the route module.
//
// What each test pins:
//   1. `isOwnerLocked` — pure function, real behavioural coverage, no DB.
//   2. Both route files call the SAME extracted function the page calls —
//      this is the DM-05 point of the whole slice.
//   3. Tenant scoping is present on every query in both `lib/` modules
//      (`ServiceOrder`/`Appointment`/`DiagnosticReport` each carry their own
//      `tenantId`, never the global `Vehicle` row).
//   4. Pagination bounds on customer history (`getApiPageInfo` is reused,
//      not reinvented, and its own clamping is exercised directly).
//   5. Both routes return 404, not 403, when the row/link is missing —
//      structural, since the routes cannot be imported (see above).
//   6. No plate-history concept was reintroduced (D-153) — struck from
//      both the page and the new `lib/` module.

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

let isOwnerLocked: typeof import("../lib/vehicles/vehicle-history").isOwnerLocked;
let getApiPageInfo: typeof import("../lib/pagination").getApiPageInfo;
let buildMeta: typeof import("../lib/pagination").buildMeta;
let requirePermission: typeof import("../lib/api").requirePermission;
let hasPermission: typeof import("../lib/auth/roles").hasPermission;

before(async () => {
  [
    { isOwnerLocked },
    { getApiPageInfo, buildMeta },
    { requirePermission },
    { hasPermission },
  ] = await Promise.all([
    import("../lib/vehicles/vehicle-history"),
    import("../lib/pagination"),
    import("../lib/api"),
    import("../lib/auth/roles"),
  ]);
});

function src(relPath: string): string {
  return readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), relPath),
    "utf8",
  );
}

function user(overrides: Partial<ApiUser> & { permissions?: string[] }): ApiUser {
  const { permissions, ...rest } = overrides;
  return {
    id: "u1",
    tenantId: "t1",
    isOwner: false,
    role: permissions ? { permissions, name: "Test" } : null,
    ...rest,
  } as ApiUser;
}

// --- lib/vehicles/vehicle-history.ts: isOwnerLocked ------------------------

test("isOwnerLocked is true when the vehicle has any order, even with zero diagnostic reports", () => {
  assert.equal(
    isOwnerLocked({ orders: [{}] as never, diagnosticReportCount: 0 }),
    true,
  );
});

test("isOwnerLocked is true when the vehicle has a diagnostic report, even with zero orders", () => {
  assert.equal(
    isOwnerLocked({ orders: [], diagnosticReportCount: 1 }),
    true,
  );
});

test("isOwnerLocked is false only when both orders and diagnostic reports are empty", () => {
  assert.equal(
    isOwnerLocked({ orders: [], diagnosticReportCount: 0 }),
    false,
  );
});

// --- lib/vehicles/vehicle-history.ts: query source pins --------------------

test("getVehicleHistory scopes ServiceOrder, Appointment and DiagnosticReport each by { tenantId, vehicleId } — never through the global Vehicle row", () => {
  const source = src("../lib/vehicles/vehicle-history.ts");
  assert.match(source, /prisma\.serviceOrder\.findMany\(\{\s*where:\s*\{\s*tenantId,\s*vehicleId\s*\}/);
  assert.match(source, /prisma\.appointment\.findMany\(\{\s*where:\s*\{\s*tenantId,\s*vehicleId\s*\}/);
  assert.match(source, /prisma\.diagnosticReport\.count\(\{\s*where:\s*\{\s*tenantId,\s*vehicleId\s*\}/);
  assert.doesNotMatch(source, /prisma\.vehicle\.findMany/);
  assert.doesNotMatch(source, /prisma\.vehicle\.findFirst/);
});

test("no plate-history concept survives in the extracted vehicle history module (D-153)", () => {
  const source = src("../lib/vehicles/vehicle-history.ts");
  assert.doesNotMatch(source, /VehiclePlateHistory/i);
  assert.doesNotMatch(source, /plateHistory/i);
});

test("no plate-history concept was reintroduced into the rewritten vehicle detail page", () => {
  const source = src("../app/dashboard/vehicles/[id]/page.tsx");
  assert.doesNotMatch(source, /VehiclePlateHistory/i);
  assert.doesNotMatch(source, /plateHistory/i);
});

// --- lib/customers/customer-history.ts: query source pins -------------------

test("getCustomerOrderHistory scopes ServiceOrder by { tenantId, customerId } and is paginated via lib/pagination.ts, not a bespoke scheme", () => {
  const source = src("../lib/customers/customer-history.ts");
  assert.match(source, /const where = \{ tenantId, customerId \}/);
  assert.match(source, /skip:\s*page\.skip/);
  assert.match(source, /take:\s*page\.take/);
  assert.match(source, /buildMeta\(total, page\.page, page\.pageSize\)/);
  assert.match(source, /import \{ buildMeta, type PageInfo, type PaginationMeta \} from "@\/lib\/pagination"/);
  // Total count backs the pagination meta rather than an unbounded fetch.
  assert.match(source, /prisma\.serviceOrder\.count\(\{ where \}\)/);
});

// --- DM-05: page and route call the SAME extracted function ----------------

test("the vehicle detail page calls the same getVehicleHistory the new history route calls, not a re-inlined query", () => {
  const pageSource = src("../app/dashboard/vehicles/[id]/page.tsx");
  const routeSource = src("../app/api/v1/vehicles/[id]/history/route.ts");

  assert.match(pageSource, /import \{ getVehicleHistory, isOwnerLocked \} from "@\/lib\/vehicles\/vehicle-history"/);
  assert.match(pageSource, /getVehicleHistory\(user\.tenantId, id\)/);
  assert.match(pageSource, /isOwnerLocked\(history\)/);

  assert.match(routeSource, /import \{ getVehicleHistory, isOwnerLocked \} from "@\/lib\/vehicles\/vehicle-history"/);
  assert.match(routeSource, /getVehicleHistory\(auth\.user\.tenantId, id\)/);

  // The page must no longer contain the inline queries this slice extracted.
  assert.doesNotMatch(pageSource, /prisma\.serviceOrder\.findMany/);
  assert.doesNotMatch(pageSource, /prisma\.appointment\.findMany/);
  assert.doesNotMatch(pageSource, /prisma\.diagnosticReport\.count/);
});

test("the customer history route calls the extracted getCustomerOrderHistory rather than an inline query (no prior web equivalent existed to diverge from)", () => {
  const routeSource = src("../app/api/v1/customers/[id]/history/route.ts");
  assert.match(routeSource, /import \{ getCustomerOrderHistory \} from "@\/lib\/customers\/customer-history"/);
  assert.match(routeSource, /getCustomerOrderHistory\(auth\.user\.tenantId, id, page\)/);
  assert.doesNotMatch(routeSource, /prisma\.serviceOrder\.findMany/);
});

// --- 404-not-403 on both routes ---------------------------------------------

test("GET /api/v1/vehicles/[id]/history returns 404, never 403, when the TenantVehicle link is missing", () => {
  const source = src("../app/api/v1/vehicles/[id]/history/route.ts");
  const permCheck = source.indexOf('requirePermission(auth.user, "vehicles.view")');
  const linkCheck = source.indexOf("prisma.tenantVehicle.findUnique");
  assert.ok(permCheck >= 0, "must call requirePermission(auth.user, \"vehicles.view\")");
  assert.ok(linkCheck > permCheck, "the tenant-link check must run after the permission gate");
  assert.match(source, /tenantId_vehicleId:\s*\{\s*tenantId:\s*auth\.user\.tenantId,\s*vehicleId:\s*id\s*\}/);
  assert.match(source, /if \(!link\) return jsonError\(404, "Машин олдсонгүй\."\);/);
  assert.doesNotMatch(source, /jsonError\(403/);
});

test("GET /api/v1/customers/[id]/history returns 404, never 403, for another tenant's customer", () => {
  const source = src("../app/api/v1/customers/[id]/history/route.ts");
  const permCheck = source.indexOf('requirePermission(auth.user, "customers.view")');
  const customerCheck = source.indexOf("prisma.customer.findFirst");
  assert.ok(permCheck >= 0, "must call requirePermission(auth.user, \"customers.view\")");
  assert.ok(customerCheck > permCheck, "the tenant-scoped customer lookup must run after the permission gate");
  assert.match(source, /where:\s*\{\s*id,\s*tenantId:\s*auth\.user\.tenantId\s*\}/);
  assert.match(source, /if \(!customer\) return customerNotFound\(\);/);
  assert.doesNotMatch(source, /jsonError\(403/);
});

// --- Permission primitives, matching the sibling detail routes' codes ------

test("customers.view and vehicles.view gate their respective history routes and each deny/grant correctly, with owner bypass", () => {
  for (const code of ["customers.view", "vehicles.view"] as const) {
    const denied = user({ permissions: ["orders.view"] });
    assert.notEqual(requirePermission(denied, code), null, `${code} must deny without the code`);

    const granted = user({ permissions: [code] });
    assert.equal(requirePermission(granted, code), null, `${code} must pass with the code`);

    const owner = user({ isOwner: true, permissions: [] });
    assert.equal(hasPermission(owner, code), true, `${code} owner bypass`);
    assert.equal(requirePermission(owner, code), null, `${code} owner bypass via requirePermission`);
  }
});

// --- Pagination bounds (lib/pagination.ts itself; customer history reuses it) --

test("getApiPageInfo clamps pageSize to [1, MAX_API_PAGE_SIZE] and defaults page to 1 for invalid input, bounding the customer history route's page size", () => {
  const huge = getApiPageInfo(new URLSearchParams("pageSize=999999"));
  assert.equal(huge.pageSize, 200); // MAX_API_PAGE_SIZE

  const zero = getApiPageInfo(new URLSearchParams("pageSize=0"));
  assert.equal(zero.pageSize >= 1, true);

  const negative = getApiPageInfo(new URLSearchParams("page=-5"));
  assert.equal(negative.page, 1);

  const junk = getApiPageInfo(new URLSearchParams("page=notanumber"));
  assert.equal(junk.page, 1);
});

test("buildMeta clamps the reported page into [1, totalPages] and reports hasNext/hasPrev consistently with pageSize=20", () => {
  const meta = buildMeta(45, 99, 20);
  assert.equal(meta.totalPages, 3);
  assert.equal(meta.page, 3); // clamped from the requested page 99
  assert.equal(meta.hasNext, false);
  assert.equal(meta.hasPrev, true);
});
