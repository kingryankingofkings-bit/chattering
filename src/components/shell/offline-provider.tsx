"use client";
import * as React from "react";
import { WifiOff } from "lucide-react";
import { idb, type OutboxItem } from "@/lib/offline/idb";

type Ctx = { online: boolean; pendingOutbox: number; flushOutbox: () => Promise<void>; refreshOutbox: () => Promise<void> };
const OfflineCtx = React.createContext<Ctx>({ online: true, pendingOutbox: 0, flushOutbox: async () => {}, refreshOutbox: async () => {} });
export const useOffline = () => React.useContext(OfflineCtx);

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const online = React.useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [pendingOutbox, setPending] = React.useState(0);
  const flushing = React.useRef(false);

  const refreshOutbox = React.useCallback(async () => {
    const items = await idb.all<OutboxItem>("outbox");
    setPending(items.length);
  }, []);

  const flushOutbox = React.useCallback(async () => {
    if (flushing.current || !navigator.onLine) return;
    flushing.current = true;
    try {
      const items = (await idb.all<OutboxItem>("outbox")).sort((a, b) => a.createdAt - b.createdAt);
      for (const item of items) {
        try {
          const res = await fetch(`/api/chats/${item.chatId}/messages`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ content: item.content, clientId: item.id, stream: false }),
          });
          if (res.ok || res.status === 409 || res.status === 400 || res.status === 404) await idb.del("outbox", item.id);
          else if (res.status === 429) break;
          else await idb.put("outbox", { ...item, attempts: item.attempts + 1 });
        } catch {
          break;
        }
      }
      window.dispatchEvent(new CustomEvent("ctr:outbox-flushed"));
    } finally {
      flushing.current = false;
      await refreshOutbox();
    }
  }, [refreshOutbox]);

  React.useEffect(() => {
    const on = () => void flushOutbox();
    window.addEventListener("online", on);
    void Promise.resolve().then(refreshOutbox);
    if (navigator.onLine) void Promise.resolve().then(flushOutbox);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
    return () => window.removeEventListener("online", on);
  }, [flushOutbox, refreshOutbox]);

  return (
    <OfflineCtx.Provider value={{ online, pendingOutbox, flushOutbox, refreshOutbox }}>
      {!online && (
        <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-warning/15 px-4 py-1.5 text-xs text-warning" role="status">
          <WifiOff className="h-3.5 w-3.5" /> Offline. Reading from your device; messages you send will be queued{pendingOutbox > 0 ? ` (${pendingOutbox} waiting)` : ""}.
        </div>
      )}
      {children}
    </OfflineCtx.Provider>
  );
}
