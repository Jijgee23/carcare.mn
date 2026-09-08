import "dotenv/config";
import assert from "node:assert/strict";
import { setTenantContext } from "../lib/tenant-context";

// Read-only application-data probe. A private advisory lock is released on
// transaction completion; no booking/table/migration is created or modified.
async function main() {
  process.env.NEXT_PHASE = "phase-production-build"; // skip unrelated pool warmup
  const { withBookingTransaction } = await import("../lib/prisma");
  const tenantId = "codex-booking-transaction-probe";
  setTenantContext(tenantId);
  let release!: () => void;
  let ready!: () => void;
  const released = new Promise<void>((resolve) => { release = resolve; });
  const locked = new Promise<void>((resolve) => { ready = resolve; });
  const first = withBookingTransaction(tenantId, async (tx) => {
    const [before] = await tx.$queryRaw<{ pid: number; tenant: string; bypass: string }[]>`
      SELECT pg_backend_pid() AS pid, current_setting('app.tenant_id') AS tenant,
        current_setting('app.bypass_rls') AS bypass
    `;
    assert.equal(before.tenant, tenantId);
    assert.equal(before.bypass, "off");
    const columns = await tx.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND
      ((table_name = 'Appointment' AND column_name IN ('estimatedDurationMinutes', 'arrivedAt')) OR
       (table_name = 'ServiceOrder' AND column_name IN ('estimatedDurationMinutes', 'expectedFinishAt', 'occupiesCapacity')))
    `;
    assert.equal(Number(columns[0].count), 5, "Scheduling columns missing");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(194836201, 83610493)`;
    ready();
    await released;
    const [after] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
    assert.equal(after.pid, before.pid);
  });
  try {
    await Promise.race([locked, first]);
    await withBookingTransaction(tenantId, async (tx) => {
      const [result] = await tx.$queryRaw<{ acquired: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(194836201, 83610493) AS acquired
      `;
      assert.equal(result.acquired, false, "Lock must remain held across transaction queries");
    });
  } finally { release(); await first; }
  await withBookingTransaction(tenantId, async (tx) => {
    const [result] = await tx.$queryRaw<{ acquired: boolean }[]>`
      SELECT pg_try_advisory_xact_lock(194836201, 83610493) AS acquired
    `;
    assert.equal(result.acquired, true, "Lock must release after transaction completion");
  });
  setTenantContext("different-tenant");
  await assert.rejects(withBookingTransaction(tenantId, async () => {}), /context mismatch/);
  console.log("PASS: five columns present; connection, tenant flags, lock lifetime and scope guard verified. No application rows written.");
}
main().then(() => process.exit(0)).catch(() => {
  console.error("Booking transaction probe failed; check migration, connectivity and transaction assertions. Connection details suppressed.");
  process.exit(1);
});
