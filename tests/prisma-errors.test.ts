import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://unused/unused";

test("isForeignKeyViolation recognises P2003 and raw adapter RESTRICT/FK errors", async () => {
  const { isForeignKeyViolation } = await import("../lib/prisma-errors");
  // Shape seen live: DriverAdapterError { cause: { originalCode: "23001", kind: "postgres" } }
  const restrict = Object.assign(new Error("restrict"), { cause: { originalCode: "23001", code: "23001", kind: "postgres" } });
  assert.equal(isForeignKeyViolation(restrict), true);
  assert.equal(isForeignKeyViolation({ code: "P2003" }), true);
  assert.equal(isForeignKeyViolation({ cause: { originalCode: "23503" } }), true);
  assert.equal(isForeignKeyViolation({ cause: { originalCode: "23505" } }), false);
  assert.equal(isForeignKeyViolation(new Error("x")), false);
  assert.equal(isForeignKeyViolation(null), false);
});
