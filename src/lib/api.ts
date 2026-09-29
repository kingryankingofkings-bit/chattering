import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AuthError, clientIp, getCurrentUser, type SafeUser } from "./auth";
import { POLICIES, checkRateLimit, rateLimitHeaders, type PolicyName } from "./rate-limit";

export class ApiError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function errorResponse(err: unknown) {
  if (err instanceof ApiError) return json({ error: err.message, ...err.extra }, { status: err.status });
  if (err instanceof AuthError) return json({ error: err.message }, { status: 401 });
  if (err instanceof z.ZodError) {
    return json({ error: "Invalid input", issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 400 });
  }
  console.error(err);
  return json({ error: "Something went wrong" }, { status: 500 });
}

export async function parseBody<T extends z.ZodTypeAny>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "Body must be JSON");
  }
  return schema.parse(raw);
}

export function parseQuery<T extends z.ZodTypeAny>(req: NextRequest, schema: T): z.infer<T> {
  const obj: Record<string, string | string[]> = {};
  for (const [k, v] of req.nextUrl.searchParams.entries()) {
    if (k in obj) obj[k] = ([] as string[]).concat(obj[k], v);
    else obj[k] = v;
  }
  return schema.parse(obj);
}

/**
 * Wrap a route handler: rate limits (per user when signed in, else per IP),
 * optional auth requirement, unified error handling.
 */
export function route<C = unknown>(
  opts: { auth?: boolean; policy?: PolicyName; ageGate?: boolean },
  handler: (ctx: { req: NextRequest; user: SafeUser | null; params: C }) => Promise<Response>,
) {
  return async (req: NextRequest, routeCtx?: { params: Promise<C> }) => {
    try {
      const user = await getCurrentUser();
      if (opts.auth !== false && !user) throw new AuthError("Sign in required");
      if (opts.ageGate !== false && user && !user.ageVerifiedAt) throw new ApiError(403, "Age verification required");
      const policy = POLICIES[opts.policy ?? "global"];
      const ip = clientIp(req.headers) ?? "anon";
      const key = `${opts.policy ?? "global"}:${user ? `u:${user.id}` : `ip:${ip}`}`;
      const rl = await checkRateLimit(key, policy);
      if (!rl.ok) {
        return json({ error: "Too many requests. Slow down a little." }, { status: 429, headers: rateLimitHeaders(rl) });
      }
      const params = routeCtx ? await routeCtx.params : (undefined as C);
      const res = await handler({ req, user, params });
      for (const [k, v] of Object.entries(rateLimitHeaders(rl))) res.headers.set(k, v);
      return res;
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export const pagination = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const v = JSON.parse(value);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
