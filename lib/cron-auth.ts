import { NextResponse } from "next/server";

/**
 * S17 (WEB_SCHEDULING_ASSESSMENT_2026-09-10.md) Phase A: every cron route
 * under app/api/cron/ duplicated an identical ~6-line secret check that
 * accepted the secret from EITHER an `Authorization: Bearer` header OR a
 * `?secret=` query-string parameter. The query-string fallback leaks the
 * secret into access logs, browser history, and referrer headers — cron
 * schedulers (Vercel Cron, QStash, cron-job.org) can all set a header, so the
 * fallback bought nothing but risk. This helper keeps ONLY the header path.
 *
 * Returns `null` when authorized, or the `NextResponse` to return (500 if
 * `CRON_SECRET` isn't configured, 401 if the supplied secret doesn't match)
 * when not — callers do `const denied = verifyCronSecret(req); if (denied) return denied;`.
 */
export function verifyCronSecret(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET тогтоогоогүй." }, { status: 500 });
  }
  const bearer = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
