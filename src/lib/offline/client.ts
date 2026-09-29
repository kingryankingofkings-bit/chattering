"use client";
/**
 * Fetch helper for client components. Adds offline awareness: GET responses
 * served by the service worker cache are flagged `fromCache`, and network
 * failures raise an OfflineError so screens can show cached data instead.
 */
export class ApiClientError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}
export class OfflineError extends Error {
  constructor() {
    super("You're offline");
  }
}

export async function api<T = unknown>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const headers = new Headers(init?.headers);
  let body = init?.body;
  if (init?.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, body, credentials: "same-origin" });
  } catch {
    throw new OfflineError();
  }
  if (res.headers.get("x-offline") === "1") throw new OfflineError();
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const msg = (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string" ? (data as { error: string }).error : null) ?? `Request failed (${res.status})`;
    throw new ApiClientError(res.status, msg, data);
  }
  return data as T;
}

function safeJson(t: string) {
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

export function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}
