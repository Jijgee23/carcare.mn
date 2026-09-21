import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Next signals `redirect()` by THROWING a control-flow error. A server action
 * that calls `redirect()` inside a `try` whose `catch` returns an error result
 * therefore turns its own success path into a failure: the write has already
 * committed, but the user is told the server broke and is never navigated.
 *
 * `createOrderAction` shipped exactly that defect in the uncommitted Phase 1
 * create extraction — an order was created, then reported as
 * "Серверийн алдаа гарлаа. Дахин оролдоно уу." The cure is `unstable_rethrow`
 * as the first statement of the catch, which is what `app/_actions/order-payments.ts`
 * already does at every one of its catch sites.
 *
 * This is a lexical guard, not a behavioral one: these modules are `"use server"`
 * and cannot be imported by a plain unit test. It brace-matches each `try`/`catch`
 * pair rather than searching the whole function, because nearly every action has
 * an unrelated early `try { user = await authorize() }` plus a perfectly safe
 * top-level `redirect()` at the end — a function-wide search reports 22 files and
 * means nothing.
 */
function unsafeRedirectCatchLines(src: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < src.length; i++) {
    if (!src.startsWith("try", i)) continue;
    if (/[A-Za-z0-9_$]/.test(src[i - 1] ?? "")) continue; // `retry`, `poetry`, ...
    const open = src.indexOf("{", i);
    if (open < 0) continue;

    let depth = 0;
    let j = open;
    for (; j < src.length; j++) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    const tryBody = src.slice(open, j);

    const catchMatch = /^\}\s*catch\s*(\([^)]*\))?\s*\{/.exec(src.slice(j, j + 400));
    if (!catchMatch) continue;

    const catchOpen = j + catchMatch[0].length - 1;
    let catchDepth = 0;
    let k = catchOpen;
    for (; k < src.length; k++) {
      if (src[k] === "{") catchDepth++;
      else if (src[k] === "}") {
        catchDepth--;
        if (catchDepth === 0) break;
      }
    }
    const catchBody = src.slice(catchOpen, k);

    if (/\bredirect\(/.test(tryBody) && !catchBody.includes("unstable_rethrow")) {
      out.push(src.slice(0, i).split("\n").length);
    }
  }
  return out;
}

test("a server action never swallows its own redirect: every catch around a redirect() rethrows", () => {
  const dir = path.join(__dirname, "..", "app", "_actions");
  const offenders: string[] = [];

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
    const src = fs.readFileSync(path.join(dir, file), "utf8");
    for (const line of unsafeRedirectCatchLines(src)) {
      offenders.push(`app/_actions/${file}:${line}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `redirect() inside a try whose catch does not call unstable_rethrow — the action ` +
      `commits its write and then reports a server error:\n  ${offenders.join("\n  ")}`,
  );
});

test("the guard actually detects the shape it claims to detect", () => {
  // Mutant: without this, a guard that silently matches nothing would pass.
  const bad = `
    export async function x() {
      try {
        await write();
        redirect("/somewhere");
      } catch (e) {
        return { ok: false };
      }
    }
  `;
  assert.equal(unsafeRedirectCatchLines(bad).length, 1, "expected the unsafe shape to be flagged");

  const good = bad.replace("return { ok: false };", "unstable_rethrow(e);\n        return { ok: false };");
  assert.deepEqual(unsafeRedirectCatchLines(good), [], "a catch that rethrows must not be flagged");

  const unrelated = `
    export async function y() {
      try { user = await authorize(); } catch (e) { return { ok: false }; }
      redirect("/safe");
    }
  `;
  assert.deepEqual(unsafeRedirectCatchLines(unrelated), [], "a top-level redirect after an unrelated catch is safe");
});
