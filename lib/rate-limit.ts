/**
 * Хөнгөн in-memory fixed-window rate limiter.
 *
 * АНХААР: энэ нь process бүрт (instance бүрт) тусдаа санах ойд хадгалагдана.
 * Нэг VPS / `next start` дээр төгс ажиллана. Олон instance / serverless
 * (Vercel) дээр гүйцэд хамгаалалт хүсвэл Redis (Upstash) / DB-backed store-оор
 * солих хэрэгтэй — энд `consumeRateLimit`-ийн интерфэйсийг хадгалаад дотор талыг
 * нь сольж болно. Аккаунтын brute-force-ийн гол хамгаалалт нь DB дахь
 * `failedLoginAttempts`/`lockedAt` (shared state) тул энэ нь нэмэлт давхарга.
 */

type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();
let lastSweep = Date.now();
const SWEEP_INTERVAL_MS = 60_000;

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, b] of store) {
    if (b.resetAt <= now) store.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  retryAfterSec: number;
  remaining: number;
};

/**
 * `key`-д зориулж нэг хүсэлт "зарцуулна". Лимит хэтэрвэл `ok: false` +
 * `retryAfterSec`-г буцаана.
 */
export function consumeRateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const b = store.get(key);
  if (!b || b.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, retryAfterSec: 0, remaining: opts.limit - 1 };
  }
  if (b.count >= opts.limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
      remaining: 0,
    };
  }
  b.count += 1;
  return { ok: true, retryAfterSec: 0, remaining: opts.limit - b.count };
}

/** Request-ээс клиентийн IP-г reverse-proxy header-үүдээс тогтооно. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
