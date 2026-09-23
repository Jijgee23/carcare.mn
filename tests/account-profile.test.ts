import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { before, test } from "node:test";

// P8-B0 — profile core (lib/account/profile.ts), extracted from
// `app/_actions/profile.ts`'s `updateProfileAction`. Mirrors
// `tests/employees-core.test.ts`'s in-memory fake-Prisma approach (the core
// takes an injectable `AccountClient`, not the `@/lib/prisma` singleton, so
// this runs with plain `tsx --test`, no real DB).

process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";

let validateProfileInput: typeof import("../lib/account/profile").validateProfileInput;
let updateProfile: typeof import("../lib/account/profile").updateProfile;

before(async () => {
  ({ validateProfileInput, updateProfile } = await import("../lib/account/profile"));
});

function src(relPath: string): string {
  return readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), relPath), "utf8");
}

function p2002(target: string[]): Error & { code: string; meta: { target: string[] } } {
  return Object.assign(new Error("Unique constraint failed"), {
    code: "P2002",
    clientVersion: "x",
    meta: { target },
  });
}

function makeFakeDb(opts: { conflict?: "email" | "phone" | "other" } = {}) {
  return {
    user: {
      async update() {
        if (opts.conflict === "email") throw p2002(["email"]);
        if (opts.conflict === "phone") throw p2002(["phone"]);
        if (opts.conflict === "other") throw new Error("boom");
        return {};
      },
    },
    // Unused by profile.ts but required by the AccountClient shape.
    userSession: {
      findMany: async () => [],
      findUnique: async () => null,
      count: async () => 0,
      updateMany: async () => ({ count: 0 }),
    },
    refreshToken: {
      findMany: async () => [],
      findUnique: async () => null,
      count: async () => 0,
      updateMany: async () => ({ count: 0 }),
    },
    async $transaction<T>(fn: (tx: unknown) => Promise<T>) {
      return fn(this);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const actor = { id: "u1", tenantId: "t1" };
const validInput = {
  firstName: "Бат",
  lastName: "Болд",
  email: "bat@example.com",
  phone: "99112233",
};

// --- validateProfileInput ----------------------------------------------------

test("validateProfileInput rejects empty firstName/lastName", () => {
  const errs = validateProfileInput({ ...validInput, firstName: "", lastName: "" });
  assert.equal(errs.firstName, "Нэрээ оруулна уу.");
  assert.equal(errs.lastName, "Овгоо оруулна уу.");
});

test("validateProfileInput rejects a malformed email", () => {
  const errs = validateProfileInput({ ...validInput, email: "not-an-email" });
  assert.equal(errs.email, "Имэйл хаяг буруу.");
});

test("validateProfileInput rejects an empty or invalid phone", () => {
  assert.equal(validateProfileInput({ ...validInput, phone: "" }).phone, "Утасны дугаар оруулна уу.");
  assert.equal(
    validateProfileInput({ ...validInput, phone: "123" }).phone,
    "Утасны дугаар 8 оронтой тоо байх ёстой.",
  );
});

test("validateProfileInput accepts a valid input (no errors)", () => {
  assert.deepEqual(validateProfileInput(validInput), {});
});

// --- updateProfile ------------------------------------------------------------

test("updateProfile returns fieldErrors and never touches the DB for invalid input", async () => {
  let touched = false;
  const db = makeFakeDb();
  db.user.update = async () => {
    touched = true;
    return {};
  };
  const result = await updateProfile(db, actor, { ...validInput, email: "bad" });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.fieldErrors?.email);
  assert.equal(touched, false);
});

test("updateProfile succeeds, lowercases email, and normalizes phone", async () => {
  const db = makeFakeDb();
  const result = await updateProfile(db, actor, { ...validInput, email: "BAT@Example.com", phone: "+976 99112233" });
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.data.email, "bat@example.com");
    assert.equal(result.data.phone, "99112233");
  }
});

test("updateProfile maps a P2002 on phone to a Mongolian phone fieldError", async () => {
  const db = makeFakeDb({ conflict: "phone" });
  const result = await updateProfile(db, actor, validInput);
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.fieldErrors?.phone === "Энэ утас өөр хэрэглэгчид бүртгэгдсэн байна.");
});

test("updateProfile maps a P2002 on email (or any other target) to a Mongolian email fieldError", async () => {
  const db = makeFakeDb({ conflict: "email" });
  const result = await updateProfile(db, actor, validInput);
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.fieldErrors?.email === "Энэ имэйл өөр хэрэглэгчид бүртгэгдсэн байна.");
});

test("updateProfile surfaces a non-P2002 error as a plain message", async () => {
  const db = makeFakeDb({ conflict: "other" });
  const result = await updateProfile(db, actor, validInput);
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.message === "boom");
});

// --- source-pattern: web action delegates to the core -------------------------

test("app/_actions/profile.ts delegates updateProfileAction to lib/account/profile instead of reimplementing it", () => {
  const source = src("../app/_actions/profile.ts");
  assert.match(source, /from "@\/lib\/account\/profile"/);
  assert.match(source, /updateProfile\(/);
  const fn = source.slice(
    source.indexOf("export async function updateProfileAction"),
    source.indexOf("export async function changePasswordAction"),
  );
  assert.doesNotMatch(fn, /prisma\.user\.update/, "updateProfileAction must not reimplement the Prisma update");
  assert.match(fn, /logAudit\(/, "updateProfileAction must still log the audit entry after a successful core call");
});

test("lib/account/profile.ts has no framework imports (use server/revalidatePath/logAudit)", () => {
  const source = src("../lib/account/profile.ts");
  assert.doesNotMatch(source, /^"use server";/m);
  assert.doesNotMatch(source, /^import.*revalidatePath/m);
  assert.doesNotMatch(source, /^import.*logAudit/m);
});
