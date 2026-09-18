import assert from "node:assert/strict";
import { before, test } from "node:test";
import { NextResponse } from "next/server";
import type {
  decideWorkingBranch as DecideWorkingBranchFn,
  DecideWorkingBranchInput,
  workingBranchForbidden as WorkingBranchForbiddenFn,
} from "../lib/auth/api-branch";

// `decideWorkingBranch` itself is pure (no Prisma, no Request — see
// lib/auth/api-branch.ts), but the *module* it lives in also exports the
// async `resolveWorkingBranch`, which statically imports lib/prisma.ts (via
// lib/api.ts and lib/employee-branch-lock.ts) purely so Node can build the
// module graph. lib/prisma.ts imports lib/env.ts, which throws at import
// time if DATABASE_URL/SESSION_SECRET aren't set in the environment. This
// suite never calls resolveWorkingBranch or touches Prisma, so — without a
// Postgres connection available — we stub harmless placeholder values
// (never overriding a real, already-configured environment) purely to let
// the module load, then import it dynamically (after the stub runs) rather
// than via a static top-level import.
process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

let decideWorkingBranch: typeof DecideWorkingBranchFn;
let workingBranchForbidden: typeof WorkingBranchForbiddenFn;

before(async () => {
  ({ decideWorkingBranch, workingBranchForbidden } = await import("../lib/auth/api-branch"));
});

const TENANT = "tenant-1";
const OTHER_TENANT = "tenant-2";

function baseInput(overrides: Partial<DecideWorkingBranchInput> = {}): DecideWorkingBranchInput {
  return {
    header: undefined,
    user: { isOwner: false, branchId: "branch-a" },
    tenantId: TENANT,
    candidateBranch: null,
    eligibleBranchIds: [],
    lockedBranchId: null,
    ...overrides,
  };
}

test("absent header, branch-locked employee -> that employee's assigned branch", () => {
  const result = decideWorkingBranch(
    baseInput({ header: undefined, user: { isOwner: false, branchId: "branch-a" } }),
  );
  assert.deepEqual(result, { ok: true, branchId: "branch-a" });
});

test("absent header, owner -> null (all branches)", () => {
  const result = decideWorkingBranch(
    baseInput({ header: undefined, user: { isOwner: true, branchId: null } }),
  );
  assert.deepEqual(result, { ok: true, branchId: null });
});

test("empty string header behaves like an absent header", () => {
  const result = decideWorkingBranch(
    baseInput({ header: "  ", user: { isOwner: false, branchId: "branch-a" } }),
  );
  assert.deepEqual(result, { ok: true, branchId: "branch-a" });
});

test('"ALL" from an owner -> null', () => {
  const result = decideWorkingBranch(
    baseInput({ header: "ALL", user: { isOwner: true, branchId: null } }),
  );
  assert.deepEqual(result, { ok: true, branchId: null });
});

test('"ALL" from a non-owner without canChooseAllBranches -> denied', () => {
  // canChooseAllBranches is false for a non-owner with a fixed branchId.
  const result = decideWorkingBranch(
    baseInput({ header: "ALL", user: { isOwner: false, branchId: "branch-a" } }),
  );
  assert.deepEqual(result, { ok: false, reason: "all_branches_not_allowed" });
});

test('"ALL" from a non-owner with no fixed branch (floating) -> allowed', () => {
  const result = decideWorkingBranch(
    baseInput({ header: "ALL", user: { isOwner: false, branchId: null } }),
  );
  assert.deepEqual(result, { ok: true, branchId: null });
});

test("another tenant's branch id -> denied", () => {
  const result = decideWorkingBranch(
    baseInput({
      header: "branch-b",
      user: { isOwner: true, branchId: null },
      tenantId: TENANT,
      candidateBranch: { tenantId: OTHER_TENANT, isActive: true },
      eligibleBranchIds: [],
    }),
  );
  assert.deepEqual(result, { ok: false, reason: "cross_tenant" });
});

test("an inactive branch -> denied", () => {
  const result = decideWorkingBranch(
    baseInput({
      header: "branch-b",
      user: { isOwner: true, branchId: null },
      candidateBranch: { tenantId: TENANT, isActive: false },
      eligibleBranchIds: [],
    }),
  );
  assert.deepEqual(result, { ok: false, reason: "inactive_branch" });
});

test("a non-owner sending a branch not in their eligible list -> denied", () => {
  const result = decideWorkingBranch(
    baseInput({
      header: "branch-c",
      user: { isOwner: false, branchId: "branch-a" },
      candidateBranch: { tenantId: TENANT, isActive: true },
      eligibleBranchIds: ["branch-a", "branch-b"],
    }),
  );
  assert.deepEqual(result, { ok: false, reason: "not_eligible" });
});

test("a non-owner sending an eligible branch -> allowed", () => {
  const result = decideWorkingBranch(
    baseInput({
      header: "branch-b",
      user: { isOwner: false, branchId: "branch-a" },
      candidateBranch: { tenantId: TENANT, isActive: true },
      eligibleBranchIds: ["branch-a", "branch-b"],
    }),
  );
  assert.deepEqual(result, { ok: true, branchId: "branch-b" });
});

test("an owner may send any active, in-tenant branch even if not in eligibleBranchIds", () => {
  const result = decideWorkingBranch(
    baseInput({
      header: "branch-z",
      user: { isOwner: true, branchId: null },
      candidateBranch: { tenantId: TENANT, isActive: true },
      eligibleBranchIds: [],
    }),
  );
  assert.deepEqual(result, { ok: true, branchId: "branch-z" });
});

test("a roster-locked employee sending a different branch -> denied", () => {
  const result = decideWorkingBranch(
    baseInput({
      header: "branch-a",
      user: { isOwner: false, branchId: "branch-a" },
      candidateBranch: { tenantId: TENANT, isActive: true },
      eligibleBranchIds: ["branch-a"],
      lockedBranchId: "branch-b",
    }),
  );
  assert.deepEqual(result, { ok: false, reason: "locked_branch_conflict" });
});

test("a roster-locked employee sending their locked branch -> allowed", () => {
  const result = decideWorkingBranch(
    baseInput({
      header: "branch-b",
      user: { isOwner: false, branchId: "branch-a" },
      candidateBranch: { tenantId: TENANT, isActive: true },
      eligibleBranchIds: ["branch-a", "branch-b"],
      lockedBranchId: "branch-b",
    }),
  );
  assert.deepEqual(result, { ok: true, branchId: "branch-b" });
});

test("garbage header value (no matching branch) -> denied", () => {
  const result = decideWorkingBranch(
    baseInput({
      header: "not-a-real-id-or-ALL",
      user: { isOwner: true, branchId: null },
      candidateBranch: null,
      eligibleBranchIds: [],
    }),
  );
  assert.deepEqual(result, { ok: false, reason: "branch_not_found" });
});

// --- P0-B1a: roster lock must be enforced on every path, including the
// "ALL" and absent-header paths, for a "floating" employee (branchId: null)
// who would otherwise pass canChooseAllBranches / branchScopeId unscoped. ---

test("floating employee (no fixed branch), roster-locked to X, absent header -> resolves to the locked branch, not ALL", () => {
  const result = decideWorkingBranch(
    baseInput({
      header: undefined,
      user: { isOwner: false, branchId: null },
      eligibleBranchIds: ["branch-x"],
      lockedBranchId: "branch-x",
    }),
  );
  // Without the fix this would be branchScopeId(user) === null (tenant-wide)
  // because the employee has no fixed branchId.
  assert.deepEqual(result, { ok: true, branchId: "branch-x" });
});

test('floating employee, roster-locked to X, header "ALL" -> denied', () => {
  const result = decideWorkingBranch(
    baseInput({
      header: "ALL",
      user: { isOwner: false, branchId: null },
      eligibleBranchIds: ["branch-x"],
      lockedBranchId: "branch-x",
    }),
  );
  // Without the fix this would be allowed: canChooseAllBranches is true for
  // a floating employee, and decideWorkingBranch used to ignore lockedBranchId
  // entirely on the "ALL" path.
  assert.deepEqual(result, { ok: false, reason: "locked_branch_conflict" });
});

test('floating employee, NOT locked today, header "ALL" -> allowed (null), to contrast with the locked case above', () => {
  const result = decideWorkingBranch(
    baseInput({
      header: "ALL",
      user: { isOwner: false, branchId: null },
      lockedBranchId: null,
    }),
  );
  assert.deepEqual(result, { ok: true, branchId: null });
});

test('owner, roster-locked to X (pinned edge case), header "ALL" -> denied', () => {
  // An owner is never roster-locked in practice — resolveTodayLockedBranch
  // keys off User.workSchedule / scheduleExceptions, which owners don't
  // carry — so this input shouldn't occur on real traffic. But
  // decideWorkingBranch is written to treat a non-null lockedBranchId as
  // authoritative regardless of isOwner (see the comment at the top of the
  // lock block in lib/auth/api-branch.ts), so we pin that behaviour here:
  // any future change to that precedence must be a deliberate, reviewed
  // decision, not an accidental regression.
  const result = decideWorkingBranch(
    baseInput({
      header: "ALL",
      user: { isOwner: true, branchId: null },
      lockedBranchId: "branch-x",
    }),
  );
  assert.deepEqual(result, { ok: false, reason: "locked_branch_conflict" });
});

test("employee locked to X, header X -> allowed", () => {
  const result = decideWorkingBranch(
    baseInput({
      header: "branch-x",
      user: { isOwner: false, branchId: "branch-x" },
      candidateBranch: { tenantId: TENANT, isActive: true },
      eligibleBranchIds: ["branch-x"],
      lockedBranchId: "branch-x",
    }),
  );
  assert.deepEqual(result, { ok: true, branchId: "branch-x" });
});

test("employee locked to X, header Y (otherwise eligible) -> denied", () => {
  const result = decideWorkingBranch(
    baseInput({
      header: "branch-y",
      user: { isOwner: false, branchId: "branch-x" },
      candidateBranch: { tenantId: TENANT, isActive: true },
      eligibleBranchIds: ["branch-x", "branch-y"],
      lockedBranchId: "branch-x",
    }),
  );
  assert.deepEqual(result, { ok: false, reason: "locked_branch_conflict" });
});

test("working-branch 403 responses preserve the body and carry a stable invalid marker", async () => {
  const response = workingBranchForbidden("not_eligible");

  assert.equal(response.status, 403);
  assert.equal(response.headers.get("x-working-branch-invalid"), "1");
  assert.deepEqual(await response.json(), {
    error: "Танд энэ салбарт ажиллах эрх байхгүй.",
  });
});

test("the invalid marker is not added to unrelated 403 responses", () => {
  const response = new NextResponse(JSON.stringify({ error: "forbidden" }), { status: 403 });

  assert.equal(response.headers.get("x-working-branch-invalid"), null);
});
