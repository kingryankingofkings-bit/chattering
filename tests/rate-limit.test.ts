import { describe, expect, it } from "vitest";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

describe("rate limiter", () => {
  it("allows up to the limit then blocks", async () => {
    const policy = { limit: 3, windowMs: 60_000 };
    const key = `t:${Math.random()}`;
    expect((await checkRateLimit(key, policy)).ok).toBe(true);
    expect((await checkRateLimit(key, policy)).ok).toBe(true);
    const third = await checkRateLimit(key, policy);
    expect(third.ok).toBe(true);
    expect(third.remaining).toBe(0);
    const fourth = await checkRateLimit(key, policy);
    expect(fourth.ok).toBe(false);
    expect(fourth.retryAfterSec).toBeGreaterThan(0);
    const h = rateLimitHeaders(fourth);
    expect(h["Retry-After"]).toBeDefined();
    expect(h["X-RateLimit-Limit"]).toBe("3");
  });

  it("isolates keys", async () => {
    const policy = { limit: 1, windowMs: 60_000 };
    expect((await checkRateLimit("a", policy)).ok).toBe(true);
    expect((await checkRateLimit("b", policy)).ok).toBe(true);
    expect((await checkRateLimit("a", policy)).ok).toBe(false);
  });
});
