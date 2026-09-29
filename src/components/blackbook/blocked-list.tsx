"use client";
import * as React from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { Avatar, Button, EmptyState, ErrorState, Skeleton, useToast } from "@/components/ui";
import { api } from "@/lib/offline/client";
import { timeAgo } from "@/lib/utils";
import { useResource } from "./use-resource";

type Blocked = { id: string; displayName: string; blockedAt: string };

export function BlockedList() {
  const toast = useToast();
  const { data, loading, error, reload, setData } = useResource<{ items: Blocked[] }>("/api/me/blocked");
  const [busy, setBusy] = React.useState<string | null>(null);
  async function unblock(u: Blocked) {
    setBusy(u.id);
    try {
      await api(`/api/users/${u.id}/block`, { method: "DELETE" });
      setData((d) => (d ? { items: d.items.filter((x) => x.id !== u.id) } : d));
      toast.push(`Unblocked ${u.displayName}`, "success");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not unblock", "error");
    } finally {
      setBusy(null);
    }
  }
  if (loading) return <div className="space-y-2" aria-busy="true">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full !rounded-2xl" />)}</div>;
  if (error || !data) return <ErrorState description={error ?? undefined} onRetry={reload} />;
  if (data.items.length === 0) return <EmptyState icon={<ShieldCheck className="h-8 w-8" />} title="Nobody blocked" description="Blocked creators' characters and content never appear in your feeds." />;
  return (
    <ul className="space-y-2">
      {data.items.map((u) => (
        <li key={u.id} className="card fade-up flex items-center gap-3 p-3">
          <Avatar name={u.displayName} seed={u.id} size={40} rounded="rounded-full" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-fg">{u.displayName}</span>
            <span className="block text-xs text-muted">blocked {timeAgo(u.blockedAt)}</span>
          </span>
          <Button variant="secondary" size="sm" loading={busy === u.id} onClick={() => unblock(u)}>
            <ShieldOff className="h-3.5 w-3.5" /> Unblock
          </Button>
        </li>
      ))}
    </ul>
  );
}
