import "server-only";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { cache } from "react";
import { prisma } from "./db";
import { hmac, randomToken } from "./crypto";
import { env, isProd } from "./env";
import type { User } from "@prisma/client";

export const SESSION_COOKIE = "ctr_session";
export const AGE_COOKIE = "ctr_age_ok";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}
export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = randomToken(32);
  const h = await headers();
  const ua = h.get("user-agent")?.slice(0, 200) ?? null;
  const ip = clientIp(h);
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hmac(token),
      userAgent: ua,
      ipHash: ip ? hmac(ip) : null,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOpts(SESSION_TTL_MS));
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hmac(token) } });
  jar.delete(SESSION_COOKIE);
  jar.delete(AGE_COOKIE);
}

export async function destroyAllSessions(userId: string) {
  await prisma.session.deleteMany({ where: { userId } });
}

function cookieOpts(maxAgeMs: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd(),
    path: "/",
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

export async function setAgeCookie() {
  const jar = await cookies();
  jar.set(AGE_COOKIE, "1", cookieOpts(365 * 24 * 60 * 60 * 1000));
}

export function clientIp(h: Headers): string | null {
  if (env().RATE_LIMIT_TRUST_PROXY === "true") {
    const xf = h.get("x-forwarded-for");
    if (xf) return xf.split(",")[0].trim();
  }
  return h.get("x-real-ip") ?? null;
}

export type SafeUser = Omit<User, "passwordHash">;

/** Cached per request. Returns null when signed out or session expired. */
export const getCurrentUser = cache(async (): Promise<SafeUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hmac(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || session.user.deletedAt) return null;
  const { passwordHash: _ph, ...safe } = session.user;
  void _ph;
  return safe;
});

export async function requireUser(): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Sign in required");
  return user;
}

export function isModerator(user: SafeUser | null) {
  return !!user && (user.role === "MODERATOR" || user.role === "ADMIN");
}

export class AuthError extends Error {
  status = 401;
}
