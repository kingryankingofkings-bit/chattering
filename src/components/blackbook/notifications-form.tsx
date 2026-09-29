"use client";
import * as React from "react";
import { ErrorState, Skeleton, Toggle, useToast } from "@/components/ui";
import type { NotificationPrefs } from "@/lib/types";
import { api } from "@/lib/offline/client";
import { useResource } from "./use-resource";

const ROWS: { key: keyof NotificationPrefs; label: string; description: string }[] = [
  { key: "newFromFollowed", label: "New from creators you follow", description: "Characters, stories and comics they publish." },
  { key: "chatReplies", label: "Chat replies", description: "When a character answers while you're away." },
  { key: "moderationUpdates", label: "Moderation updates", description: "Decisions and appeals on your content." },
  { key: "productNews", label: "Product news", description: "Occasional updates about Chattering." },
];

export function NotificationsForm() {
  const toast = useToast();
  const { data, loading, error, reload, setData } = useResource<{ notificationPrefs: NotificationPrefs }>("/api/me");
  const [busy, setBusy] = React.useState<string | null>(null);
  if (loading) return <Skeleton className="h-64 w-full !rounded-2xl" />;
  if (error || !data) return <ErrorState description={error ?? undefined} onRetry={reload} />;
  async function toggle(key: keyof NotificationPrefs, value: boolean) {
    setBusy(key);
    const prev = data!.notificationPrefs;
    setData({ notificationPrefs: { ...prev, [key]: value } });
    try {
      const res = await api<{ notificationPrefs: NotificationPrefs }>("/api/me/notifications", { method: "PUT", json: { [key]: value } });
      setData({ notificationPrefs: res.notificationPrefs });
      toast.push("Saved", "success");
    } catch (err) {
      setData({ notificationPrefs: prev });
      toast.push(err instanceof Error ? err.message : "Could not save", "error");
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="card space-y-1 p-4" aria-busy={!!busy}>
      {ROWS.map((r) => (
        <Toggle key={r.key} checked={data.notificationPrefs[r.key]} onChange={(v) => toggle(r.key, v)} label={r.label} description={r.description} />
      ))}
    </div>
  );
}
