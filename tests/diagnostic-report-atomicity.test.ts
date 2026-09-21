/**
 * D-123/D-127 linked diagnostic-report atomicity contract.
 *
 * The implementation must add `lib/diagnostic-report-commit.ts` with a shared
 * `commitDiagnosticReportCommand(input, dependencies?)` seam. Linked reports
 * (`orderId`, with or without `itemId`) are committed under one parent-order
 * lock. Standalone reports may use the non-transactional store. The command
 * returns domain success/failure results so API and dashboard adapters can
 * preserve their existing response/message vocabulary.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { before, test } from "node:test";
import type { ReportEntry } from "../lib/diagnostics";
import { commitWithReportUploadCleanup } from "../lib/diagnostics-server";

type OrderSnapshot = {
  id: string;
  tenantId: string;
  customerId: string;
  vehicleId: string;
  branchId: string;
  status: string;
  assignedToId: string | null;
};

type ItemSnapshot = {
  id: string;
  diagnosticTemplateId: string | null;
  startedAt: Date | null;
};

type ReportRecord = {
  id: string;
  tenantId: string;
  orderId: string | null;
  customerId: string;
  vehicleId: string;
  branchId: string;
  templateId: string;
};

type ReportWrite = {
  tenantId: string;
  filledById: string;
  orderId: string | null;
  customerId: string;
  vehicleId: string;
  branchId: string;
  templateId: string;
  templateVersion: number;
  data: Record<string, ReportEntry>;
  signatureUrl: string | null;
  mileageAtReport: number | null;
  notes: string | null;
  maxSeverity: "GOOD" | "WARN" | "BAD" | null;
};

type ItemQuery = {
  where: {
    id: string;
    orderId: string;
    kind: "DIAGNOSTIC";
    status: { not: "CANCELLED" };
    diagnosticReportId: null;
  };
  select: {
    id: true;
    diagnosticTemplateId: true;
    startedAt: true;
  };
};

type TransactionPort = {
  findAvailableItem: (query: ItemQuery) => Promise<ItemSnapshot | null>;
  createReport: (write: ReportWrite) => Promise<ReportRecord>;
  completeItem: (input: {
    itemId: string;
    reportId: string;
    completedAt: Date;
    startedAt: Date | null;
  }) => Promise<void>;
};

type CommitFailureCode =
  | "ORDER_NOT_FOUND"
  | "ORDER_SCOPE_FORBIDDEN"
  | "ORDER_EDIT_FORBIDDEN"
  | "ORDER_LOCKED"
  | "ORDER_NOT_IN_PROGRESS"
  | "DIAGNOSTIC_ITEM_UNAVAILABLE"
  | "DIAGNOSTIC_TEMPLATE_MISMATCH";

type CommitResult =
  | { ok: true; report: ReportRecord }
  | {
      ok: false;
      status: 403 | 404 | 422;
      code: CommitFailureCode;
    };

type OrderSelect = {
  id: true;
  tenantId: true;
  customerId: true;
  vehicleId: true;
  branchId: true;
  status: true;
  assignedToId: true;
};

type CommitInput = {
  tenantId: string;
  actorId: string;
  workingBranchId: string | null;
  orderId: string | null;
  itemId: string | null;
  templateId: string;
  templateVersion: number;
  data: Record<string, ReportEntry>;
  signatureUrl: string | null;
  mileageAtReport: number | null;
  notes: string | null;
  maxSeverity: "GOOD" | "WARN" | "BAD" | null;
  standaloneCustomerId: string;
  standaloneVehicleId: string;
  standaloneBranchId: string;
};

type CommitDependencies = {
  withLockedOrder: (
    tenantId: string,
    orderId: string,
    select: OrderSelect,
    work: (
      transaction: TransactionPort,
      order: OrderSnapshot | null,
    ) => Promise<CommitResult>,
  ) => Promise<CommitResult>;
  createStandaloneReport: (write: ReportWrite) => Promise<ReportRecord>;
  canEditOrder: (order: OrderSnapshot) => boolean;
  now: () => Date;
};

type CommitDiagnosticReportCommand = (
  input: CommitInput,
  dependencies?: CommitDependencies,
) => Promise<CommitResult>;

type AtomicityModule = {
  commitDiagnosticReportCommand: CommitDiagnosticReportCommand;
};

let atomicityModule: AtomicityModule | undefined;
let loadError: unknown;

before(async () => {
  try {
    atomicityModule = (await import(
      "../lib/diagnostic-report-commit"
    )) as unknown as AtomicityModule;
  } catch (error) {
    loadError = error;
  }
});

function command(): CommitDiagnosticReportCommand {
  if (loadError || !atomicityModule) {
    const reason =
      loadError instanceof Error ? loadError.message : String(loadError);
    throw new Error(`lib/diagnostic-report-commit.ts failed to load: ${reason}`);
  }
  assert.equal(
    typeof atomicityModule.commitDiagnosticReportCommand,
    "function",
    "commitDiagnosticReportCommand must be exported",
  );
  return atomicityModule.commitDiagnosticReportCommand;
}

const lockedOrder: OrderSnapshot = {
  id: "order-1",
  tenantId: "tenant-1",
  customerId: "customer-locked",
  vehicleId: "vehicle-locked",
  branchId: "branch-locked",
  status: "IN_PROGRESS",
  assignedToId: "employee-1",
};

const availableItem: ItemSnapshot = {
  id: "item-1",
  diagnosticTemplateId: "template-1",
  startedAt: new Date("2026-09-20T01:00:00.000Z"),
};

function input(overrides: Partial<CommitInput> = {}): CommitInput {
  return {
    tenantId: "tenant-1",
    actorId: "actor-1",
    workingBranchId: "branch-locked",
    orderId: "order-1",
    itemId: null,
    templateId: "template-1",
    templateVersion: 3,
    data: { inspection: { value: "ok" } },
    signatureUrl: "/uploads/diagnostics/signatures/signature.png",
    mileageAtReport: 12345,
    notes: "notes",
    maxSeverity: "GOOD",
    standaloneCustomerId: "customer-stale",
    standaloneVehicleId: "vehicle-stale",
    standaloneBranchId: "branch-stale",
    ...overrides,
  };
}

type HarnessOptions = {
  order?: OrderSnapshot | null;
  item?: ItemSnapshot | null;
  canEdit?: boolean;
  failCompletion?: boolean;
};

function createHarness(options: HarnessOptions = {}) {
  const state: {
    reports: ReportRecord[];
    item: (ItemSnapshot & { diagnosticReportId: string | null }) | null;
  } = {
    reports: [],
    item:
      options.item === null
        ? null
        : {
            ...(options.item ?? availableItem),
            diagnosticReportId: null,
          },
  };
  const calls = {
    locks: [] as Array<{
      tenantId: string;
      orderId: string;
      select: OrderSelect;
    }>,
    itemQueries: [] as ItemQuery[],
    standaloneWrites: [] as ReportWrite[],
    transactionWrites: [] as ReportWrite[],
    completions: [] as Array<{
      itemId: string;
      reportId: string;
      completedAt: Date;
      startedAt: Date | null;
    }>,
    authorizationChecks: 0,
  };
  const order = options.order === undefined ? lockedOrder : options.order;
  const completedAt = new Date("2026-09-20T02:00:00.000Z");

  function reportFrom(write: ReportWrite): ReportRecord {
    return {
      id: `report-${state.reports.length + 1}`,
      tenantId: write.tenantId,
      orderId: write.orderId,
      customerId: write.customerId,
      vehicleId: write.vehicleId,
      branchId: write.branchId,
      templateId: write.templateId,
    };
  }

  const dependencies: CommitDependencies = {
    async withLockedOrder(tenantId, orderId, select, work) {
      calls.locks.push({ tenantId, orderId, select });
      const reportsBefore = state.reports.slice();
      const itemBefore = state.item ? { ...state.item } : null;
      const transaction: TransactionPort = {
        async findAvailableItem(query) {
          calls.itemQueries.push(query);
          if (
            !state.item ||
            state.item.id !== query.where.id ||
            state.item.diagnosticReportId !== null
          ) {
            return null;
          }
          return {
            id: state.item.id,
            diagnosticTemplateId: state.item.diagnosticTemplateId,
            startedAt: state.item.startedAt,
          };
        },
        async createReport(write) {
          calls.transactionWrites.push(write);
          const report = reportFrom(write);
          state.reports.push(report);
          return report;
        },
        async completeItem(completion) {
          calls.completions.push(completion);
          if (options.failCompletion) throw new Error("item completion failed");
          if (!state.item || state.item.id !== completion.itemId) {
            throw new Error("item missing");
          }
          state.item.diagnosticReportId = completion.reportId;
        },
      };
      try {
        const result = await work(transaction, order);
        if (!result.ok) {
          state.reports = reportsBefore;
          state.item = itemBefore;
        }
        return result;
      } catch (error) {
        state.reports = reportsBefore;
        state.item = itemBefore;
        throw error;
      }
    },
    async createStandaloneReport(write) {
      calls.standaloneWrites.push(write);
      const report = reportFrom(write);
      state.reports.push(report);
      return report;
    },
    canEditOrder(orderToCheck) {
      calls.authorizationChecks += 1;
      assert.equal(orderToCheck, order);
      return options.canEdit ?? true;
    },
    now: () => completedAt,
  };

  return { calls, completedAt, dependencies, state };
}

const expectedOrderSelect: OrderSelect = {
  id: true,
  tenantId: true,
  customerId: true,
  vehicleId: true,
  branchId: true,
  status: true,
  assignedToId: true,
};

test("order-linked creation locks by tenant/order, revalidates, and writes locked ownership", async () => {
  const harness = createHarness();

  const result = await command()(input(), harness.dependencies);

  assert.equal(result.ok, true);
  assert.deepEqual(harness.calls.locks, [
    {
      tenantId: "tenant-1",
      orderId: "order-1",
      select: expectedOrderSelect,
    },
  ]);
  assert.equal(harness.calls.authorizationChecks, 1);
  assert.equal(harness.calls.standaloneWrites.length, 0);
  assert.deepEqual(harness.calls.transactionWrites, [
    {
      tenantId: "tenant-1",
      filledById: "actor-1",
      orderId: "order-1",
      customerId: "customer-locked",
      vehicleId: "vehicle-locked",
      branchId: "branch-locked",
      templateId: "template-1",
      templateVersion: 3,
      data: { inspection: { value: "ok" } },
      signatureUrl: "/uploads/diagnostics/signatures/signature.png",
      mileageAtReport: 12345,
      notes: "notes",
      maxSeverity: "GOOD",
    },
  ]);
});

test("linked revalidation rejects missing, wrong-tenant, and wrong-order snapshots", async (t) => {
  const cases: Array<{ name: string; order: OrderSnapshot | null }> = [
    { name: "missing", order: null },
    {
      name: "wrong tenant",
      order: { ...lockedOrder, tenantId: "tenant-other" },
    },
    {
      name: "wrong order",
      order: { ...lockedOrder, id: "order-other" },
    },
  ];

  for (const entry of cases) {
    await t.test(entry.name, async () => {
      const harness = createHarness({ order: entry.order });
      const result = await command()(input(), harness.dependencies);
      assert.deepEqual(result, {
        ok: false,
        status: 404,
        code: "ORDER_NOT_FOUND",
      });
      assert.equal(harness.calls.authorizationChecks, 0);
      assert.deepEqual(harness.state.reports, []);
    });
  }
});

test("linked revalidation rejects branch scope, permission, and both invalid status classes under the lock", async (t) => {
  const cases: Array<{
    name: string;
    input?: Partial<CommitInput>;
    options?: HarnessOptions;
    failure: CommitResult;
  }> = [
    {
      name: "wrong branch",
      input: { workingBranchId: "branch-other" },
      failure: {
        ok: false,
        status: 403,
        code: "ORDER_SCOPE_FORBIDDEN",
      },
    },
    {
      name: "permission denied",
      options: { canEdit: false },
      failure: {
        ok: false,
        status: 403,
        code: "ORDER_EDIT_FORBIDDEN",
      },
    },
    {
      name: "locked order",
      options: { order: { ...lockedOrder, status: "COMPLETED" } },
      failure: {
        ok: false,
        status: 422,
        code: "ORDER_LOCKED",
      },
    },
    {
      name: "not started",
      options: { order: { ...lockedOrder, status: "SCHEDULED" } },
      failure: {
        ok: false,
        status: 422,
        code: "ORDER_NOT_IN_PROGRESS",
      },
    },
  ];

  for (const entry of cases) {
    await t.test(entry.name, async () => {
      const harness = createHarness(entry.options);
      const result = await command()(
        input(entry.input),
        harness.dependencies,
      );
      assert.deepEqual(result, entry.failure);
      assert.deepEqual(harness.state.reports, []);
      assert.equal(harness.calls.transactionWrites.length, 0);
    });
  }
});

test("both unrestricted and matching branch scopes allow a valid linked report", async (t) => {
  for (const workingBranchId of [null, "branch-locked"] as const) {
    await t.test(String(workingBranchId), async () => {
      const harness = createHarness();
      const result = await command()(
        input({ workingBranchId }),
        harness.dependencies,
      );
      assert.equal(result.ok, true);
      assert.equal(harness.state.reports.length, 1);
    });
  }
});

test("item-linked creation reads, creates, and completes through the same transaction", async () => {
  const harness = createHarness();

  const result = await command()(
    input({ itemId: "item-1" }),
    harness.dependencies,
  );

  assert.equal(result.ok, true);
  assert.deepEqual(harness.calls.itemQueries, [
    {
      where: {
        id: "item-1",
        orderId: "order-1",
        kind: "DIAGNOSTIC",
        status: { not: "CANCELLED" },
        diagnosticReportId: null,
      },
      select: {
        id: true,
        diagnosticTemplateId: true,
        startedAt: true,
      },
    },
  ]);
  assert.equal(harness.calls.transactionWrites.length, 1);
  assert.deepEqual(harness.calls.completions, [
    {
      itemId: "item-1",
      reportId: "report-1",
      completedAt: harness.completedAt,
      startedAt: availableItem.startedAt,
    },
  ]);
  assert.equal(harness.state.item?.diagnosticReportId, "report-1");
});

test("item-linked creation rejects unavailable items and template mismatches before report insert", async (t) => {
  await t.test("unavailable", async () => {
    const harness = createHarness({ item: null });
    const result = await command()(
      input({ itemId: "item-1" }),
      harness.dependencies,
    );
    assert.deepEqual(result, {
      ok: false,
      status: 422,
      code: "DIAGNOSTIC_ITEM_UNAVAILABLE",
    });
    assert.deepEqual(harness.state.reports, []);
  });

  await t.test("template mismatch", async () => {
    const harness = createHarness({
      item: { ...availableItem, diagnosticTemplateId: "template-other" },
    });
    const result = await command()(
      input({ itemId: "item-1" }),
      harness.dependencies,
    );
    assert.deepEqual(result, {
      ok: false,
      status: 422,
      code: "DIAGNOSTIC_TEMPLATE_MISMATCH",
    });
    assert.deepEqual(harness.state.reports, []);
  });
});

test("serialized concurrent item submissions create exactly one report", async () => {
  const harness = createHarness();
  const create = command();

  const first = await create(
    input({ itemId: "item-1" }),
    harness.dependencies,
  );
  const second = await create(
    input({ itemId: "item-1" }),
    harness.dependencies,
  );

  assert.equal(first.ok, true);
  assert.deepEqual(second, {
    ok: false,
    status: 422,
    code: "DIAGNOSTIC_ITEM_UNAVAILABLE",
  });
  assert.equal(harness.state.reports.length, 1);
  assert.equal(harness.calls.locks.length, 2);
});

test("item completion failure rolls back the report and item mutation", async () => {
  const harness = createHarness({ failCompletion: true });

  await assert.rejects(
    command()(input({ itemId: "item-1" }), harness.dependencies),
    /item completion failed/,
  );

  assert.deepEqual(harness.state.reports, []);
  assert.equal(harness.state.item?.diagnosticReportId, null);
});

test("linked non-success rolls back before request-owned uploads are cleaned", async () => {
  const harness = createHarness({
    order: { ...lockedOrder, status: "COMPLETED" },
  });
  const deletes: string[] = [];
  const path = "/uploads/diagnostics/request-owned.png";

  const result = await commitWithReportUploadCleanup(
    [path],
    () => command()(input(), harness.dependencies),
    (value) => value.ok,
    async (uploadPath) => {
      assert.deepEqual(harness.state.reports, []);
      deletes.push(uploadPath);
    },
  );

  assert.equal(result.ok, false);
  assert.deepEqual(deletes, [path]);
});

test("transaction exception rolls back before request-owned uploads are cleaned", async () => {
  const harness = createHarness({ failCompletion: true });
  const deletes: string[] = [];
  const path = "/uploads/diagnostics/request-owned.png";

  await assert.rejects(
    commitWithReportUploadCleanup(
      [path],
      () =>
        command()(input({ itemId: "item-1" }), harness.dependencies),
      (value) => value.ok,
      async (uploadPath) => {
        assert.deepEqual(harness.state.reports, []);
        assert.equal(harness.state.item?.diagnosticReportId, null);
        deletes.push(uploadPath);
      },
    ),
    /item completion failed/,
  );
  assert.deepEqual(deletes, [path]);
});

test("a post-commit side-effect failure cannot trigger upload cleanup", async () => {
  const harness = createHarness();
  const deletes: string[] = [];

  const result = await commitWithReportUploadCleanup(
    ["/uploads/diagnostics/request-owned.png"],
    () => command()(input(), harness.dependencies),
    (value) => value.ok,
    async (uploadPath) => {
      deletes.push(uploadPath);
    },
  );
  assert.equal(result.ok, true);

  await assert.rejects(
    async () => {
      throw new Error("audit failed after commit");
    },
    /audit failed after commit/,
  );
  assert.equal(harness.state.reports.length, 1);
  assert.deepEqual(deletes, []);
});

test("standalone reports remain outside the order lock", async () => {
  const harness = createHarness();

  const result = await command()(
    input({ orderId: null, itemId: null }),
    harness.dependencies,
  );

  assert.equal(result.ok, true);
  assert.deepEqual(harness.calls.locks, []);
  assert.equal(harness.calls.standaloneWrites.length, 1);
  assert.deepEqual(harness.calls.standaloneWrites[0], {
    tenantId: "tenant-1",
    filledById: "actor-1",
    orderId: null,
    customerId: "customer-stale",
    vehicleId: "vehicle-stale",
    branchId: "branch-stale",
    templateId: "template-1",
    templateVersion: 3,
    data: { inspection: { value: "ok" } },
    signatureUrl: "/uploads/diagnostics/signatures/signature.png",
    mileageAtReport: 12345,
    notes: "notes",
    maxSeverity: "GOOD",
  });
});

function matchingClose(
  source: string,
  openIndex: number,
  open = "(",
  close = ")",
): number {
  assert.equal(source[openIndex], open);
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === open) depth += 1;
    else if (source[index] === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error("unbalanced source fixture");
}

function adapterAtomicityIssues(
  source: string,
  adapter: "api" | "dashboard",
): string[] {
  const issues: string[] = [];
  const commandMarker = "commitDiagnosticReportCommand(";
  const commandAt = source.indexOf(commandMarker);
  if (commandAt < 0) issues.push("shared atomic command missing");

  const requiredShape = [
    "tenantId:",
    "actorId:",
    "workingBranchId:",
    "orderId:",
    "itemId:",
    "templateId:",
  ];
  if (commandAt >= 0) {
    const openAt = source.indexOf("(", commandAt);
    const commandCall = source.slice(openAt, matchingClose(source, openAt) + 1);
    for (const token of requiredShape) {
      if (!commandCall.includes(token)) issues.push(`command input missing ${token}`);
    }
  }

  const wrapperMarker = "commitWithReportUploadCleanup(";
  let wrapperAt = source.indexOf(wrapperMarker);
  let commandIsCompensated = false;
  let commandWrapperClose = -1;
  while (wrapperAt >= 0) {
    const openAt = source.indexOf("(", wrapperAt);
    const closeAt = matchingClose(source, openAt);
    const wrapperCall = source.slice(wrapperAt, closeAt + 1);
    if (
      wrapperCall.includes("collected.uploadedPaths") &&
      wrapperCall.includes(commandMarker)
    ) {
      commandIsCompensated = true;
      commandWrapperClose = closeAt;
      break;
    }
    wrapperAt = source.indexOf(wrapperMarker, closeAt + 1);
  }
  if (!commandIsCompensated) {
    issues.push("atomic command is not inside request-upload compensation");
  }

  if (/prisma\.serviceItem\.update\(/.test(source)) {
    issues.push("global item completion remains in adapter");
  }
  if (/tx\.serviceItem\.update\(/.test(source)) {
    issues.push("item completion remains duplicated in adapter");
  }
  if (/withOrderTransaction\(/.test(source)) {
    issues.push("order lock remains duplicated in adapter");
  }

  if (adapter === "dashboard" && commandWrapperClose >= 0) {
    const auditAt = source.indexOf("await logAudit(", commandWrapperClose);
    if (auditAt < 0) issues.push("post-commit audit is not outside compensation");
  }
  return issues;
}

const API_FAILURE_VOCABULARY = [
  "Засварын хуудас олдсонгүй.",
  "Зөвхөн өөрийн салбарт оношилгоо бүртгэх боломжтой.",
  "Танд энэ засварын хуудсанд оношилгоо бөглөх эрх байхгүй.",
  "Оношилгооны тайланг зөвхөн ажиллаж буй захиалгад бүртгэнэ үү.",
  "ORDER_STATUS_INVALID",
  "Оношилгооны мөр олдсонгүй эсвэл аль хэдийн бөглөгдсөн байна.",
  "Оношилгооны мөрийн загвартай тохирох загвар сонгоно уу.",
  "DIAGNOSTIC_TEMPLATE_MISMATCH",
] as const;

const DASHBOARD_FAILURE_VOCABULARY = [
  "Засварын хуудас олдсонгүй.",
  "Зөвхөн өөрийн салбарт оношилгоо бүртгэх боломжтой.",
  "Танд энэ засварын хуудсанд оношилгоо бөглөх эрх байхгүй.",
  "Дууссан / цуцлагдсан засварын хуудсанд оношилгоо бөглөх боломжгүй.",
  "Засварын хуудас эхлээгүй байна. Эхлүүлсний дараа оношилгоо бөглөнө.",
  "Оношилгооны мөр олдсонгүй эсвэл аль хэдийн бөглөгдсөн байна.",
] as const;

function adapterBehaviorMappingIssues(
  source: string,
  adapter: "api" | "dashboard",
): string[] {
  const commandAt = source.indexOf("commitDiagnosticReportCommand(");
  if (commandAt < 0) return ["shared atomic command missing for failure mapping"];
  const mappingSource = source.slice(commandAt);
  const vocabulary =
    adapter === "api" ? API_FAILURE_VOCABULARY : DASHBOARD_FAILURE_VOCABULARY;
  return vocabulary
    .filter((token) => !mappingSource.includes(token))
    .map((token) => `post-command failure mapping missing ${token}`);
}

test("adapter atomicity guard detects call, shape, transaction, and side-effect mutants", () => {
  const validDashboard = `
    const committed = await commitWithReportUploadCleanup(
      collected.uploadedPaths,
      () => commitDiagnosticReportCommand({
        tenantId: user.tenantId,
        actorId: user.id,
        workingBranchId: scope,
        orderId: orderId || null,
        itemId: itemId || null,
        templateId: template.id,
      }),
      (result) => result.ok,
    );
    await logAudit({ entityId: committed.report.id });
  `;
  assert.deepEqual(
    adapterAtomicityIssues(validDashboard, "dashboard"),
    [],
  );

  assert.deepEqual(
    adapterAtomicityIssues(
      validDashboard.replace(
        "commitDiagnosticReportCommand",
        "createDiagnosticReportDirectly",
      ),
      "dashboard",
    ),
    [
      "shared atomic command missing",
      "atomic command is not inside request-upload compensation",
    ],
  );

  assert.deepEqual(
    adapterAtomicityIssues(
      validDashboard.replace("workingBranchId: scope,", ""),
      "dashboard",
    ),
    ["command input missing workingBranchId:"],
  );

  assert.deepEqual(
    adapterAtomicityIssues(
      validDashboard.replace(
        "collected.uploadedPaths",
        "preExistingUploadPaths",
      ),
      "dashboard",
    ),
    ["atomic command is not inside request-upload compensation"],
  );

  assert.deepEqual(
    adapterAtomicityIssues(
      `${validDashboard}\nprisma.serviceItem.update({});`,
      "dashboard",
    ),
    ["global item completion remains in adapter"],
  );

  assert.deepEqual(
    adapterAtomicityIssues(
      `${validDashboard}\nwithOrderTransaction();`,
      "dashboard",
    ),
    ["order lock remains duplicated in adapter"],
  );

  const auditInside = validDashboard.replace(
    "      (result) => result.ok,\n    );\n    await logAudit({ entityId: committed.report.id });",
    "      async (result) => { await logAudit({ entityId: result.report.id }); return result.ok; },\n    );",
  );
  assert.deepEqual(adapterAtomicityIssues(auditInside, "dashboard"), [
    "post-commit audit is not outside compensation",
  ]);
});

test("adapter failure-mapping guard detects user-visible behavior mutants", () => {
  const apiMapping = `
    const committed = await commitDiagnosticReportCommand({});
    if (!committed.ok) {
      return mapFailure(committed.code, {
        orderMissing: "Засварын хуудас олдсонгүй.",
        branch: "Зөвхөн өөрийн салбарт оношилгоо бүртгэх боломжтой.",
        permission: "Танд энэ засварын хуудсанд оношилгоо бөглөх эрх байхгүй.",
        status: "Оношилгооны тайланг зөвхөн ажиллаж буй захиалгад бүртгэнэ үү.",
        statusCode: "ORDER_STATUS_INVALID",
        item: "Оношилгооны мөр олдсонгүй эсвэл аль хэдийн бөглөгдсөн байна.",
        template: "Оношилгооны мөрийн загвартай тохирох загвар сонгоно уу.",
        templateCode: "DIAGNOSTIC_TEMPLATE_MISMATCH",
      });
    }
  `;
  assert.deepEqual(adapterBehaviorMappingIssues(apiMapping, "api"), []);
  for (const token of API_FAILURE_VOCABULARY) {
    const mutant = apiMapping.replace(token, `removed-${token.length}`);
    assert.deepEqual(adapterBehaviorMappingIssues(mutant, "api"), [
      `post-command failure mapping missing ${token}`,
    ]);
  }

  const dashboardMapping = `
    const committed = await commitDiagnosticReportCommand({});
    if (!committed.ok) {
      return mapFailure(committed.code, {
        orderMissing: "Засварын хуудас олдсонгүй.",
        branch: "Зөвхөн өөрийн салбарт оношилгоо бүртгэх боломжтой.",
        permission: "Танд энэ засварын хуудсанд оношилгоо бөглөх эрх байхгүй.",
        locked: "Дууссан / цуцлагдсан засварын хуудсанд оношилгоо бөглөх боломжгүй.",
        notStarted: "Засварын хуудас эхлээгүй байна. Эхлүүлсний дараа оношилгоо бөглөнө.",
        item: "Оношилгооны мөр олдсонгүй эсвэл аль хэдийн бөглөгдсөн байна.",
      });
    }
  `;
  assert.deepEqual(
    adapterBehaviorMappingIssues(dashboardMapping, "dashboard"),
    [],
  );
  for (const token of DASHBOARD_FAILURE_VOCABULARY) {
    const mutant = dashboardMapping.replace(token, `removed-${token.length}`);
    assert.deepEqual(adapterBehaviorMappingIssues(mutant, "dashboard"), [
      `post-command failure mapping missing ${token}`,
    ]);
  }
});

test("API and dashboard adapters call the shared atomic command with the required shape", async () => {
  const [apiSource, dashboardSource] = await Promise.all([
    readFile(
      new URL(
        "../app/api/v1/diagnostics/reports/route.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/_actions/diagnostic-reports.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.deepEqual(adapterAtomicityIssues(apiSource, "api"), []);
  assert.deepEqual(adapterAtomicityIssues(dashboardSource, "dashboard"), []);
  assert.deepEqual(adapterBehaviorMappingIssues(apiSource, "api"), []);
  assert.deepEqual(
    adapterBehaviorMappingIssues(dashboardSource, "dashboard"),
    [],
  );
});
