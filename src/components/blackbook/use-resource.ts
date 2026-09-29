"use client";
import * as React from "react";
import { api } from "@/lib/offline/client";

/** Minimal fetch-once resource with loading / error / reload, for non-paginated screens. */
export function useResource<T>(url: string | null) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(!!url);
  const [error, setError] = React.useState<string | null>(null);
  const reqId = React.useRef(0);

  const load = React.useCallback(async () => {
    if (!url) return;
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const d = await api<T>(url);
      if (id === reqId.current) setData(d);
    } catch (err) {
      if (id === reqId.current) setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [url]);

  React.useEffect(() => {
    // Deferred a tick so no state update happens synchronously inside the effect body.
    void Promise.resolve().then(() => load());
  }, [load]);

  return { data, loading, error, reload: load, setData };
}
