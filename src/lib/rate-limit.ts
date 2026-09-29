/**
 * Sliding-window rate limiter with a pluggable store. The default store is
 * in-memory (per server process). Swap `setRateLimitStore` for Redis when
 * running multiple instances.
 */

export interface RateLimitStore {
  hit(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
}

class MemoryStore implements RateLimitStore {
  private buckets = new Map<string, number[]>();
  private lastSweep = Date.now();

  async hit(key: string, windowMs: number) {
    const now = Date.now();
    const since = now - windowMs;
    const arr = (this.buckets.get(key) ?? []).filter((t) => t > since);
    arr.push(now);
    this.buckets.set(key, arr);
    if (now - this.lastSweep > 60_000) this.sweep(now);
    return { count: arr.length, resetAt: (arr[0] ?? now) + windowMs };
  }

  private sweep(now: number) {
    this.lastSweep = now;
    for (const [k, arr] of this.buckets) {
      if (arr.length === 0 || arr[arr.length - 1] < now - 15 * 60_000) this.buckets.delete(k);
    }
  }
}

const g = globalThis as unknown as { __rlStore?: RateLimitStore };
export function setRateLimitStore(store: RateLimitStore) {
  g.__rlStore = store;
}
function store(): RateLimitStore {
  if (!g.__rlStore) g.__rlStore = new MemoryStore();
  return g.__rlStore;
}

export type RateLimitPolicy = { limit: number; windowMs: number };

/** Named policies; tune per route. */
export const POLICIES = {
  global: { limit: 300, windowMs: 60_000 },
  auth: { limit: 10, windowMs: 15 * 60_000 },
  chat: { limit: 40, windowMs: 60_000 },
  generate: { limit: 12, windowMs: 60_000 },
  image: { limit: 6, windowMs: 60_000 },
  write: { limit: 60, windowMs: 60_000 },
  report: { limit: 10, windowMs: 60 * 60_000 },
  read: { limit: 240, windowMs: 60_000 },
} satisfies Record<string, RateLimitPolicy>;

export type PolicyName = keyof typeof POLICIES;

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
};

export async function checkRateLimit(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
  const { count, resetAt } = await store().hit(key, policy.windowMs);
  const ok = count <= policy.limit;
  return {
    ok,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - count),
    resetAt,
    retryAfterSec: ok ? 0 : Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
  };
}

export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  const h: Record<string, string> = {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(Math.ceil(r.resetAt / 1000)),
  };
  if (!r.ok) h["Retry-After"] = String(r.retryAfterSec);
  return h;
}
