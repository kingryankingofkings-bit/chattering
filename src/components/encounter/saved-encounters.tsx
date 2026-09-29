"use client";
import * as React from "react";
import { BookmarkCheck, Play, RotateCcw, Trash2 } from "lucide-react";
import { Avatar, Button, Chip, IntensityBadge, SectionTitle, useToast } from "@/components/ui";
import type { SavedEncounterItem } from "@/lib/encounter";
import { api } from "@/lib/offline/client";
import { timeAgo } from "@/lib/utils";

export function SavedEncounters({ items, onLoad, onStartChat, onDeleted, startingId }: { items: SavedEncounterItem[]; onLoad: (item: SavedEncounterItem) => void; onStartChat: (item: SavedEncounterItem) => void; onDeleted: (id: string) => void; startingId: string | null }) {
  const toast = useToast();
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const sorted = React.useMemo(() => [...items].sort((a, b) => Number(b.isTemplate) - Number(a.isTemplate)), [items]);

  async function remove(id: string) {
    setDeleting(id);
    try {
      await api(`/api/encounters/${id}`, { method: "DELETE" });
      onDeleted(id);
      toast.push("Deleted", "success");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not delete", "error");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section aria-labelledby="saved-h">
      <SectionTitle title="Saved encounters" subtitle={items.length ? `${items.length} saved · templates first` : undefined} action={<BookmarkCheck className="h-4 w-4 text-gold" aria-hidden />} />
      {sorted.length === 0 ? (
        <p className="card px-4 py-4 text-sm text-muted">Nothing saved yet. Roll an encounter you like and tap Save to keep it here.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((it) => {
            const c = it.character;
            return (
              <li key={it.id} className="card flex gap-3 p-3">
                {c ? <Avatar name={c.name} seed={c.avatarSeed} src={c.avatarUrl} size={56} /> : <Avatar name="?" seed={it.id} size={56} />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="truncate text-sm">{it.name}</h3>
                    {it.isTemplate && <Chip size="sm" tone="gold">template</Chip>}
                    <IntensityBadge level={it.data.intensity} />
                  </div>
                  <p className="truncate text-xs text-muted">
                    {c ? c.name : "Character no longer available"} · {it.data.scenarioTitle} · {timeAgo(it.createdAt)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => onLoad(it)} disabled={!c}>
                      <RotateCcw className="h-3.5 w-3.5" /> Load
                    </Button>
                    <Button size="sm" onClick={() => onStartChat(it)} disabled={!c} loading={startingId === it.id}>
                      <Play className="h-3.5 w-3.5" fill="currentColor" /> Start chat
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(it.id)} loading={deleting === it.id} aria-label={`Delete ${it.name}`} className="ml-auto text-danger">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
