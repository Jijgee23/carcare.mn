import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

// D-191: staff phone-in booking (`registerAppointmentByStaffCommand`) notifies
// the linked Account with `appointment_booked_by_staff` — a NEW type, distinct
// from the pre-existing STAFF-realm `appointment_created` ("онлайн хүсэлт
// ирлээ"). This is a source-pattern test (like account-password.test.ts):
// asserts the call shape/ordering directly from source, since exercising the
// real command needs a full Prisma transaction + reservation stack.

function src(relPath: string): string {
  return readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), relPath), "utf8");
}

const commandSrc = src("../lib/appointments/appointment-create-command.ts");
const notificationsSrc = src("../lib/notifications.ts");

test("registerAppointmentByStaffCommand notifies only when customer.accountId is set", () => {
  const guardIdx = commandSrc.indexOf("if (customer.accountId) {");
  assert.ok(guardIdx >= 0, "expected an `if (customer.accountId)` guard around the notify call");
  const notifyIdx = commandSrc.indexOf("type: \"appointment_booked_by_staff\"");
  assert.ok(notifyIdx > guardIdx, "notify call must be inside the accountId guard");
});

test("notify call happens after reserveAppointment and after logAudit, wrapped in try/catch", () => {
  const reserveIdx = commandSrc.indexOf("created = await reserveAppointment(");
  const auditIdx = commandSrc.indexOf("await logAudit({");
  const notifyIdx = commandSrc.indexOf("type: \"appointment_booked_by_staff\"");
  const tryIdx = commandSrc.lastIndexOf("try {", notifyIdx);
  const catchIdx = commandSrc.indexOf("console.warn(\"[notify] registerAppointmentByStaffCommand:\"", notifyIdx);

  assert.ok(reserveIdx >= 0 && auditIdx >= 0 && tryIdx >= 0 && notifyIdx >= 0 && catchIdx >= 0);
  assert.ok(reserveIdx < auditIdx, "reservation must happen before the audit log");
  assert.ok(auditIdx < tryIdx, "audit log must happen before the notify attempt");
  assert.ok(tryIdx < notifyIdx && notifyIdx < catchIdx, "notify call must be inside its own try/catch");
});

test("recipient and data keys mirror appointment_confirmed's shape (recipient.accountId, data.appointmentId)", () => {
  const block = commandSrc.slice(
    commandSrc.indexOf("if (customer.accountId) {"),
    commandSrc.indexOf("return { appointmentId: created.id };"),
  );
  assert.match(block, /recipient:\s*\{\s*accountId:\s*customer\.accountId\s*\}/);
  assert.match(block, /appointmentId:\s*created\.id/);
});

test("appointment_booked_by_staff is registered account-realm in NOTIFICATION_REGISTRY, distinct from staff-realm appointment_created", () => {
  assert.match(notificationsSrc, /"appointment_booked_by_staff",/);

  const registryStart = notificationsSrc.indexOf("export const NOTIFICATION_REGISTRY");
  const createdBlockStart = notificationsSrc.indexOf("appointment_created: {", registryStart);
  const bookedBlockStart = notificationsSrc.indexOf("appointment_booked_by_staff: {", registryStart);
  assert.ok(createdBlockStart >= 0 && bookedBlockStart >= 0);

  const createdBlock = notificationsSrc.slice(createdBlockStart, notificationsSrc.indexOf("\n  },", createdBlockStart));
  const bookedBlock = notificationsSrc.slice(bookedBlockStart, notificationsSrc.indexOf("\n  },", bookedBlockStart));

  assert.match(createdBlock, /realm:\s*"staff"/);
  assert.match(bookedBlock, /realm:\s*"account"/);
  assert.match(bookedBlock, /data:\s*\{\s*type:\s*"appointment_booked_by_staff",\s*appointmentId:\s*i\.appointmentId\s*\?\?\s*""\s*\}/);
  assert.match(bookedBlock, /href:\s*\(d\)\s*=>\s*appointmentHref\(d\)/);
});

test("body builder uses formatBusinessDateTime (explicit timeZone), never the host-local formatWhen", () => {
  const builderSrc = src("../lib/appointments/appointment-booked-by-staff-notification.ts");
  assert.match(builderSrc, /import \{ formatBusinessDateTime \} from "@\/lib\/account-closure\/appointment-cancellation";/);
  assert.doesNotMatch(builderSrc, /formatWhen\(/);
  assert.match(commandSrc, /import \{ buildAppointmentBookedByStaffBody \} from "@\/lib\/appointments\/appointment-booked-by-staff-notification";/);
});
