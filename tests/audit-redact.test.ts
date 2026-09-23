import assert from "node:assert/strict";
import { test } from "node:test";
import { redactAuditJson } from "../lib/audit-redact";

test("redacts a top-level secret key, case-insensitively", () => {
  const out = redactAuditJson({ passwordHash: "abc", firstName: "Bat" }) as Record<string, unknown>;
  assert.equal(out.passwordHash, "[redacted]");
  assert.equal(out.firstName, "Bat");
});

test("redacts nested secret keys at any depth", () => {
  const out = redactAuditJson({
    user: { profile: { token: "t", refreshToken: "r", name: "Bold" } },
  }) as { user: { profile: Record<string, unknown> } };
  assert.equal(out.user.profile.token, "[redacted]");
  assert.equal(out.user.profile.refreshToken, "[redacted]");
  assert.equal(out.user.profile.name, "Bold");
});

test("redacts secret keys inside arrays", () => {
  const out = redactAuditJson([
    { apiKey: "k1" },
    { otp: "123456", ok: true },
  ]) as Record<string, unknown>[];
  assert.equal(out[0].apiKey, "[redacted]");
  assert.equal(out[1].otp, "[redacted]");
  assert.equal(out[1].ok, true);
});

test("redacts secret keys nested inside arrays inside objects", () => {
  const out = redactAuditJson({
    sessions: [{ secret: "s" }, { clientSecret: "cs" }],
  }) as { sessions: Record<string, unknown>[] };
  assert.equal(out.sessions[0].secret, "[redacted]");
  assert.equal(out.sessions[1].clientSecret, "[redacted]");
});

test("matches secret substrings case-insensitively regardless of surrounding text", () => {
  const out = redactAuditJson({ userPasswordConfirm: "x", PASSWORD: "y" }) as Record<string, unknown>;
  assert.equal(out.userPasswordConfirm, "[redacted]");
  assert.equal(out.PASSWORD, "[redacted]");
});

test("passes through null, primitives, and Date instances unchanged", () => {
  const d = new Date();
  assert.equal(redactAuditJson(null), null);
  assert.equal(redactAuditJson(42), 42);
  assert.equal(redactAuditJson("hi"), "hi");
  assert.equal(redactAuditJson(d), d);
});

test("does not mutate the input", () => {
  const input = { passwordHash: "abc" };
  redactAuditJson(input);
  assert.equal(input.passwordHash, "abc");
});
