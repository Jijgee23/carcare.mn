// P7-B1 — redacts secret-shaped keys out of `AuditLog.before`/`after` JSON
// before it ever leaves the server via `GET /api/v1/audit`. Web audit
// display is unaffected — this is API-route-only (see route.ts).
//
// `before`/`after` are secret-free today only by call-site discipline (see
// `TENANT_MOBILE_SLICES.md`, Phase 7 entry state); this is a defense-in-depth
// guard for the new JSON-serializing surface, not a claim that call sites
// were audited.

const SECRET_KEY_SUBSTRINGS = [
  "password",
  "passwordhash",
  "token",
  "refreshtoken",
  "accesstoken",
  "otp",
  "secret",
  "apikey",
  "privatekey",
  "clientsecret",
  "authorization",
] as const;

const REDACTED = "[redacted]";

function isSecretKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SECRET_KEY_SUBSTRINGS.some((needle) => lower.includes(needle));
}

/**
 * Recursively drops (replaces with `"[redacted]"`) any object key whose name
 * contains a secret-like substring (case-insensitive), at any depth,
 * including inside arrays. Non-plain values (Date, null, primitives) pass
 * through unchanged; arrays and plain objects are walked.
 */
export function redactAuditJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactAuditJson(item));
  }
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSecretKey(key) ? REDACTED : redactAuditJson(val);
    }
    return out;
  }
  return value;
}
