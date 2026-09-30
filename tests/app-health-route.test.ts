import assert from "node:assert/strict";
import { test } from "node:test";

import { GET } from "../app/api/v1/app/health/route";

test("health returns uncached JSON ok without touching the DB", async () => {
  const res = GET();
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /application\/json/);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual(await res.json(), { ok: true });
});
