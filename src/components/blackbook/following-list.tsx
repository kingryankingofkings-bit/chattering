"use client";
import * as React from "react";
import Link from "next/link";
import { UserMinus, Users } from "lucide-react";
import { Avatar, Button, EmptyState, ErrorState, Skeleton, useToast } from "@/components/ui";
import { api } from "@/lib/offline/client";
import { useResource } from "./use-resource";

type Creator = { id: string; displayName: string; avatarUrl?: string | null; characterCount: number };

export function FollowingList() {
  const toast = useToast();
  const { data, loading, error, reload, setData } = useResource<{ items: Creator[] }>("/api/me/following");
  const [busy, setBusy] = React.useState<string | null>(null);
  async function unfollow(c: Creator) {
    setBusy(c.id);
    try {
      await api(`/api/users/${c.id}/follow`, { method: "DELETE" });
      setData((d) => (d ? { items: d.items.filter((x) => x.id !== c.id) } : d));
      toast.push(`Unfollowed ${c.displayName}`, "success");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not unfollow", "error");
    } finally {
      setBusy(null);
    }
  }
  if (loading) return <div className="space-y-2" aria-busy="true">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full !rounded-2xl" />)}</div>;
  if (error || !data) return <ErrorState description={error ?? undefined} onRetry={reload} />;
  if (data.items.length === 0) return <EmptyState icon={<Users className="h-8 w-8" />} title="Not following anyone" description="Follow creators from their character profiles to see their new work first." action={<Button href="/explore" variant="secondary">Explore</Button>} />;
  return (
    <ul className="space-y-2">
      {data.items.map((c) => (
        <li key={c.id} className="card fade-up flex items-center gap-3 p-3">
          <Link href={`/creator/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3 focus-ring rounded-xl">
            <Avatar name={c.displayName} seed={c.id} src={c.avatarUrl ?? null} size={44} rounded="rounded-full" />
            <span className="min-w-0">
              <span className="block truncate text-sm text-fg">{c.displayName}</span>
              <span className="block text-xs text-muted">{c.characterCount} public character{c.characterCount === 1 ? "" : "s"}</span>
            </span>
          </Link>
          <Button variant="secondary" size="sm" loading={busy === c.id} onClick={() => unfollow(c)}>
            <UserMinus className="h-3.5 w-3.5" /> Unfollow
          </Button>
        </li>
      ))}
    </ul>
  );
}
