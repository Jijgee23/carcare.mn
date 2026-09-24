import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

// Web hardening S7/S8. Uploads: no SVG, and the stored type comes from the
// file's magic bytes, not the browser-declared MIME. Security headers,
// HUR timeouts, cron claim-before-send, one FCM token per owner.

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

let uploadDir: string;
let storage: typeof import("../lib/storage");

before(async () => {
  uploadDir = await mkdtemp(path.join(tmpdir(), "carcare-upload-test-"));
  process.env.UPLOAD_DIR = uploadDir;
  storage = await import("../lib/storage");
});

after(async () => {
  await rm(uploadDir, { recursive: true, force: true });
});

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);
const file = (bytes: Buffer, type: string, name = "x") => new File([new Uint8Array(bytes)], name, { type });

test("SVG is rejected even when declared honestly", async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  await assert.rejects(storage.saveUpload(file(svg, "image/svg+xml"), "t"));
});

test("HTML declared as image/png is rejected by magic-byte check", async () => {
  await assert.rejects(storage.saveUpload(file(Buffer.from("<html><script>1</script></html>"), "image/png"), "t"));
});

test("real PNG/JPEG/WEBP are stored with the sniffed extension", async () => {
  const png = await storage.saveUpload(file(PNG, "image/png"), "t");
  assert.match(png.path, /\.png$/);
  // Declared as png but the bytes are JPEG: extension and mime follow the bytes.
  const jpeg = await storage.saveUpload(file(JPEG, "image/png"), "t");
  assert.match(jpeg.path, /\.jpg$/);
  assert.equal(jpeg.mime, "image/jpeg");
  const webp = await storage.saveUpload(file(WEBP, "image/webp"), "t");
  assert.match(webp.path, /\.webp$/);
  assert.equal((await readdir(path.join(uploadDir, "t"))).length, 3);
});

test("next.config sets baseline security headers", () => {
  const src = read("../next.config.ts");
  for (const h of ["X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Strict-Transport-Security"]) {
    assert.match(src, new RegExp(`key: "${h}"`), h);
  }
});

test("both HUR fetches have a timeout", () => {
  assert.equal(read("../lib/hur_service.ts").match(/signal: AbortSignal\.timeout\(HUR_TIMEOUT_MS\)/g)?.length, 2);
});

test("subscription reminder claims the row before sending", () => {
  const src = read("../app/api/cron/subscription-reminders/route.ts");
  const claim = src.search(/reminderSentAt: null \},\s*data: \{ reminderSentAt: now \}/);
  const send = src.indexOf("await createNotification(");
  assert.ok(claim > 0 && send > claim);
  assert.doesNotMatch(src, /prisma\.subscription\.update\(/);
});

test("registering a device clears the same FCM token from other devices first", () => {
  const src = read("../lib/devices.ts");
  const fn = src.slice(src.indexOf("export async function registerDevice"));
  const clear = fn.indexOf("NOT: { deviceId: input.deviceId }");
  const upsert = fn.indexOf("prisma.device.upsert(");
  assert.ok(clear > 0 && upsert > clear);
});
