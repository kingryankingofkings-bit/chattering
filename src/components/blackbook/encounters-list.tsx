"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Dices, Play, Trash2 } from "lucide-react";
import { Avatar, Button, Chip, EmptyState, ErrorState, IntensityBadge, Skeleton, useToast } from "@/components/ui";
import type { EncounterItem } from "@/lib/blackbook";
import { api } from "@/lib/offline/client";
import { timeAgo } from "@/lib/utils";
import { AddToCollectionButton } from "./add-to-collection";
import { ConfirmSheet } from "./confirm-sheet";
import { useResource } from "./use-resource";

export function EncountersList() {
  const router = useRouter();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useResource<{ items: EncounterItem[] }>("/api/encounters");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<EncounterItem | null>(null);

  async function start(e: EncounterItem) {
    setBusy(e.id);
    try {
      const res = await api<{ id: string }>("/api/chats", { method: "POST", json: { characterId: e.character.id, context: { version: 1, scenarioTitle: e.data.scenarioTitle, setting: e.data.setting, hook: e.data.hook, intensity: e.data.intensity, origin: "encounter" } } });
      router.push(`/chat/${res.id}`);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not start chat", "error");
      setBusy(null);
    }
  }
  async function remove() {
    if (!confirm) return;
    setBusy(confirm.id);
    try {
      await api(`/api/encounters/${confirm.id}`, { method: "DELETE" });
      setData((d) => (d ? { items: d.items.filter((x) => x.id !== confirm.id) } : d));
      toast.push("Encounter deleted", "success");
      setConfirm(null);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not delete", "error");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="space-y-2" aria-busy="true">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full !rounded-2xl" />)}</div>;
  if (error || !data) return <ErrorState description={error ?? undefined} onRetry={reload} />;
  if (data.items.length === 0) return <EmptyState icon={<Dices className="h-8 w-8" />} title="No saved encounters" description="Roll a scenario in Encounter and save the ones worth returning to." action={<Button href="/encounter" variant="secondary">Open Encounter</Button>} />;
  return (
    <>
      <ul className="space-y-3">
        {data.items.map((e) => (
          <li key={e.id} className="card fade-up space-y-3 p-3">
            <div className="flex items-start gap-3">
              <Avatar name={e.character.name} seed={e.character.avatarSeed} src={e.character.avatarUrl} size={48} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base leading-tight">{e.name || e.data.scenarioTitle}</p>
                <p className="text-xs text-muted">with {e.character.name} · {timeAgo(e.createdAt)}{e.isTemplate ? " · template" : ""}</p>
                {(e.data.setting || e.data.hook) && <p className="mt-1 line-clamp-2 text-xs text-fg-2">{e.data.hook || e.data.setting}</p>}
              </div>
              <IntensityBadge level={e.data.intensity} />
            </div>
            {e.data.themes.length > 0 && (
              <div className="scrollbar-none flex gap-1 overflow-x-auto">
                {e.data.themes.slice(0, 5).map((t) => <Chip key={t} size="sm">{t}</Chip>)}
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => start(e)} loading={busy === e.id}>
                <Play className="h-3.5 w-3.5" /> Start chat
              </Button>
              <AddToCollectionButton targetType="ENCOUNTER" targetId={e.id} iconOnly className="h-8 w-8 rounded-lg" />
              <Button variant="ghost" size="sm" className="ml-auto text-danger" onClick={() => setConfirm(e)} aria-label={`Delete ${e.name}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <ConfirmSheet open={!!confirm} title="Delete encounter?" body={<>“{confirm?.name}” will be removed from your saved encounters.</>} confirmLabel="Delete" danger loading={!!busy} onClose={() => setConfirm(null)} onConfirm={remove} />
    </>
  );
}
