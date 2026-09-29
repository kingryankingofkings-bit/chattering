/* Chattering service worker: app-shell + read-API caching for offline use. */
const VERSION = "v1";
const SHELL_CACHE = `ctr-shell-${VERSION}`;
const API_CACHE = `ctr-api-${VERSION}`;
const MEDIA_CACHE = `ctr-media-${VERSION}`;
const SHELL_URLS = ["/offline", "/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Static assets: cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(caches.open(SHELL_CACHE).then(async (c) => (await c.match(req)) || fetch(req).then((r) => { c.put(req, r.clone()); return r; })));
    return;
  }
  // Media: cache-first with network fill.
  if (url.pathname.startsWith("/api/media/")) {
    event.respondWith(caches.open(MEDIA_CACHE).then(async (c) => (await c.match(req)) || fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; })));
    return;
  }
  // Read APIs: network-first, fall back to cache.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      caches.open(API_CACHE).then(async (c) => {
        try {
          const r = await fetch(req);
          if (r.ok) c.put(req, r.clone());
          return r;
        } catch {
          const cached = await c.match(req);
          return cached || new Response(JSON.stringify({ error: "offline", offline: true }), { status: 503, headers: { "content-type": "application/json", "x-offline": "1" } });
        }
      }),
    );
    return;
  }
  // Navigations: network-first, cached page, then offline page.
  if (req.mode === "navigate") {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (c) => {
        try {
          const r = await fetch(req);
          if (r.ok) c.put(req, r.clone());
          return r;
        } catch {
          return (await c.match(req)) || (await c.match("/offline")) || Response.error();
        }
      }),
    );
  }
});
