import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

test("status codes in audit summaries are shown in Mongolian", async () => {
  const { humanizeAuditSummary } = await import("../lib/audit-summary");
  assert.equal(humanizeAuditSummary("IN_PROGRESS → COMPLETED"), "Хийгдэж байна → Дууссан");
  assert.equal(humanizeAuditSummary("Бэлэн · 100,000₮ бүртгэв"), "Бэлэн · 100,000₮ бүртгэв");
});

test("hurUserMessage fixes the upstream 'төв -с' typo", async () => {
  const { hurUserMessage } = await import("../lib/hur-message");
  assert.equal(
    hurUserMessage("Тээврийн хэрэгслийн мэдээлэл үндэсний төв -с олдсонгүй"),
    "Тээврийн хэрэгслийн мэдээлэл үндэсний төвөөс олдсонгүй",
  );
  assert.equal(hurUserMessage("other"), "other");
});

const ORDER_ID = "cmuozdfq20010uwigrt8ea8hl";
const ITEM_ID = "cmuozeboc0018uwigqgs58jpa";

test("extractAuditRefs collects order and item ids", async () => {
  const { extractAuditRefs } = await import("../lib/audit-summary");
  assert.deepEqual(
    extractAuditRefs(`-1 (засварын хуудас #${ORDER_ID}) цуцалсан мөр ${ITEM_ID}`),
    { orderIds: [ORDER_ID], itemIds: [ITEM_ID] },
  );
  assert.deepEqual(extractAuditRefs("Бэлэн"), { orderIds: [], itemIds: [] });
});

test("audit summary order ids become order numbers, unknown ids stay", async () => {
  const { humanizeAuditSummary } = await import("../lib/audit-summary");
  const s = `-1 (засварын хуудас #${ORDER_ID})`;
  assert.equal(
    humanizeAuditSummary(s, { orderNumbers: new Map([[ORDER_ID, 42]]) }),
    "-1 (засварын хуудас #42)",
  );
  assert.equal(humanizeAuditSummary(s, { orderNumbers: new Map() }), s);
});

test("audit summary item ids become labels or are dropped", async () => {
  const { humanizeAuditSummary } = await import("../lib/audit-summary");
  const itemLabels = new Map([[ITEM_ID, "Тосны шүүлтүүр"]]);
  assert.equal(
    humanizeAuditSummary(`цуцалсан мөр ${ITEM_ID}`, { itemLabels }),
    "цуцалсан мөр «Тосны шүүлтүүр»",
  );
  assert.equal(humanizeAuditSummary(`цуцалсан мөр ${ITEM_ID}`), "цуцалсан мөр");
  assert.equal(
    humanizeAuditSummary(`(мөр ${ITEM_ID}, оношилгоо бөглөж эхэлсэн)`, { itemLabels }),
    "(мөр «Тосны шүүлтүүр», оношилгоо бөглөж эхэлсэн)",
  );
});

test("item kind codes are translated", async () => {
  const { humanizeAuditSummary } = await import("../lib/audit-summary");
  const { ITEM_KIND_LABEL } = await import("../lib/orders");
  assert.equal(
    humanizeAuditSummary("PART · MK Oil +1 (нэгтгэв) → × 2"),
    `${ITEM_KIND_LABEL.PART} · MK Oil +1 (нэгтгэв) → × 2`,
  );
});
