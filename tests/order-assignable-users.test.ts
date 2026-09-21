import assert from "node:assert/strict";
import test from "node:test";
import { hasPermission } from "../lib/auth/roles";
import {
  branchFilterConflicts,
  buildAssignableUserWhere,
  isAssignableUserEligible,
  toAssignableUserDto,
  type AssignableUserEligibilityInput,
} from "../lib/orders/order-assignable-users";

const TENANT = "tenant-a";
const BRANCH = "branch-a";

function user(
  overrides: Partial<AssignableUserEligibilityInput> = {},
): AssignableUserEligibilityInput {
  return {
    isActive: true,
    tenantId: TENANT,
    isOwner: false,
    branchId: BRANCH,
    assignableBranchIds: [],
    role: { permissions: ["orders.assignable"], isActive: true },
    ...overrides,
  };
}

test("owners and active assignable users are eligible", () => {
  assert.equal(isAssignableUserEligible(user(), TENANT, BRANCH), true);
  assert.equal(
    isAssignableUserEligible(
      user({ isOwner: true, role: null, branchId: null }),
      TENANT,
      BRANCH,
    ),
    true,
  );
});

test("inactive users, inactive roles and users without assignment permission are excluded", () => {
  assert.equal(isAssignableUserEligible(user({ isActive: false }), TENANT, BRANCH), false);
  assert.equal(
    isAssignableUserEligible(
      user({ role: { permissions: ["orders.assignable"], isActive: false } }),
      TENANT,
      BRANCH,
    ),
    false,
  );
  assert.equal(
    isAssignableUserEligible(user({ role: { permissions: [], isActive: true } }), TENANT, BRANCH),
    false,
  );
});

test("tenant and branch eligibility are mandatory", () => {
  assert.equal(isAssignableUserEligible(user({ tenantId: "tenant-attacker" }), TENANT, BRANCH), false);
  assert.equal(isAssignableUserEligible(user({ branchId: "other-branch" }), TENANT, BRANCH), false);
  assert.equal(
    isAssignableUserEligible(
      user({ branchId: "other-branch", assignableBranchIds: [BRANCH] }),
      TENANT,
      BRANCH,
    ),
    true,
  );
  assert.equal(isAssignableUserEligible(user({ branchId: null }), TENANT, BRANCH), true);
  assert.equal(isAssignableUserEligible(user({ branchId: "other-branch" }), TENANT), true);
});

test("working-branch lock rejects a different requested branch", () => {
  assert.equal(branchFilterConflicts(BRANCH, "other-branch"), true);
  assert.equal(branchFilterConflicts(BRANCH, BRANCH), false);
  assert.equal(branchFilterConflicts(null, "other-branch"), false);
});

test("Prisma predicate keeps tenant, active, assignable role and branch lock conjunctive", () => {
  const where = buildAssignableUserWhere({ tenantId: TENANT, branchId: BRANCH });
  assert.equal(where.tenantId, TENANT);
  assert.equal(where.isActive, true);
  assert.ok(Array.isArray(where.AND));
  assert.deepEqual(where.AND, [
    {
      OR: [
        { isOwner: true },
        { role: { permissions: { has: "orders.assignable" } } },
      ],
    },
    { OR: [{ isOwner: true }, { role: { isActive: true } }] },
    {
      OR: [
        { branchId: null },
        { branchId: BRANCH },
        { assignableBranchIds: { has: BRANCH } },
      ],
    },
  ]);
});

test("unscoped predicate does not invent a branch filter", () => {
  const where = buildAssignableUserWhere({ tenantId: TENANT });
  assert.equal(where.tenantId, TENANT);
  assert.equal(where.isActive, true);
  assert.equal((where.AND as unknown[]).length, 2);
});

test("permission gate requires orders.assign", () => {
  assert.equal(hasPermission({ isOwner: false, role: { permissions: ["orders.assign"] } }, "orders.assign"), true);
  assert.equal(hasPermission({ isOwner: false, role: { permissions: [] } }, "orders.assign"), false);
  assert.equal(hasPermission({ isOwner: true, role: null }, "orders.assign"), true);
});

test("DTO exposes only minimal identity/display fields", () => {
  const dto = toAssignableUserDto({
    id: "user-1",
    firstName: "Ada",
    lastName: "Lovelace",
  });
  assert.deepEqual(dto, { id: "user-1", firstName: "Ada", lastName: "Lovelace" });
  assert.deepEqual(Object.keys(dto).sort(), ["firstName", "id", "lastName"]);
});
