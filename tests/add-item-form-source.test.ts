import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const src = () =>
  readFileSync("app/dashboard/orders/[id]/add-item-form.tsx", "utf8");

test("tab state is owned by AddItemForm, not the keyed FormContent", () => {
  const s = src();
  const parent = s.slice(
    s.indexOf("export function AddItemForm"),
    s.indexOf("function FormContent"),
  );
  assert.match(parent, /useState<Tab>/);
});

test("field errors are dismissed on edit", () => {
  assert.match(src(), /setDismissed\(true\)/);
});

test("form remount key is a success counter, not an ok/idle toggle", () => {
  assert.doesNotMatch(src(), /state\?\.ok \? "ok" : "idle"/);
});
