import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate: sign-in cookie + age cookie must exist before any app route
 * renders. Full session validation happens server-side in getCurrentUser().
 * Also applies security headers to every response.
 */
const SESSION_COOKIE = "ctr_session";
const AGE_COOKIE = "ctr_age_ok";

const PUBLIC_PREFIXES = ["/login", "/signup", "/legal", "/api/auth", "/manifest.webmanifest", "/sw.js", "/offline", "/icons", "/_next", "/favicon.ico"];

function withSecurityHeaders(res: NextResponse) {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  res.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  return res;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p));
  const signedIn = !!req.cookies.get(SESSION_COOKIE)?.value;
  const ageOk = !!req.cookies.get(AGE_COOKIE)?.value;

  if (pathname === "/") {
    return withSecurityHeaders(NextResponse.redirect(new URL(signedIn ? (ageOk ? "/explore" : "/age-gate") : "/login", req.url)));
  }

  if (!isPublic) {
    if (pathname.startsWith("/api/")) {
      if (!signedIn) return withSecurityHeaders(NextResponse.json({ error: "Sign in required" }, { status: 401 }));
    } else if (!signedIn) {
      const url = new URL("/login", req.url);
      url.searchParams.set("next", pathname);
      return withSecurityHeaders(NextResponse.redirect(url));
    } else if (!ageOk && pathname !== "/age-gate") {
      return withSecurityHeaders(NextResponse.redirect(new URL("/age-gate", req.url)));
    }
  }
  if ((pathname === "/login" || pathname === "/signup") && signedIn) {
    return withSecurityHeaders(NextResponse.redirect(new URL(ageOk ? "/explore" : "/age-gate", req.url)));
  }
  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons/).*)"],
};
