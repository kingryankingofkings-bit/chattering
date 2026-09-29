"use client";
import * as React from "react";
import { api, OfflineError } from "@/lib/offline/client";
import { idb } from "@/lib/offline/idb";

export type Page<T> = { items: T[]; nextCursor: string | null };

/**
 * Cursor-paginated infinite feed with offline fallback. Pass a stable `key`
 * (e.g. the query string); the first page is cached in IndexedDB so the feed
 * still renders offline.
 */
export function useInfiniteFeed<T extends { id: string }>(url: string, opts?: { enabled?: boolean; cacheKey?: string }) {
  const [items, setItems] = React.useState<T[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [offline, setOffline] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const reqId = React.useRef(0);
  const cacheKey = opts?.cacheKey ?? `feed:${url}`;
  const enabled = opts?.enabled ?? true;

  const load = React.useCallback(
    async (after: string | null) => {
      const id = ++reqId.current;
      if (after) setLoadingMore(true);
      else {
        setLoading(true);
        setItems([]);
        setCursor(null);
        setDone(false);
      }
      setError(null);
      try {
        const sep = url.includes("?") ? "&" : "?";
        const page = await api<Page<T>>(after ? `${url}${sep}cursor=${encodeURIComponent(after)}` : url);
        if (id !== reqId.current) return;
        setItems((prev) => (after ? [...prev, ...page.items] : page.items));
        setCursor(page.nextCursor);
        setDone(!page.nextCursor);
        setOffline(false);
        if (!after) void idb.put("feeds", { id: cacheKey, items: page.items, savedAt: Date.now() });
      } catch (err) {
        if (id !== reqId.current) return;
        if (err instanceof OfflineError && !after) {
          const cached = await idb.get<{ id: string; items: T[] }>("feeds", cacheKey);
          if (cached) {
            setItems(cached.items);
            setDone(true);
            setOffline(true);
            return;
          }
        }
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (id === reqId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [url, cacheKey],
  );

  React.useEffect(() => {
    if (!enabled) return;
    void Promise.resolve().then(() => load(null));
  }, [load, enabled]);

  const loadMore = React.useCallback(() => {
    if (loading || loadingMore || done || !cursor) return;
    void load(cursor);
  }, [load, loading, loadingMore, done, cursor]);

  const sentinelRef = React.useCallback(
    (node: HTMLElement | null) => {
      if (!node) return;
      const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), { rootMargin: "600px" });
      io.observe(node);
      return () => io.disconnect();
    },
    [loadMore],
  );

  const mutate = React.useCallback((fn: (items: T[]) => T[]) => setItems(fn), []);

  return { items, loading, loadingMore, error, offline, done, loadMore, refresh: () => load(null), sentinelRef, mutate };
}
