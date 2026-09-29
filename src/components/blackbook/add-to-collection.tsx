"use client";
import * as React from "react";
import { Check, FolderPlus, Plus } from "lucide-react";
import { Button, Input, Sheet, Skeleton, useToast } from "@/components/ui";
import type { CollectionDto, CollectionTargetType } from "@/lib/blackbook";
import { api } from "@/lib/offline/client";

/**
 * "Add to collection" button + sheet. Lists the user's collections, adds the
 * target with one tap, and can create a new collection inline.
 * Reusable from any tab: <AddToCollectionButton targetType="CHARACTER" targetId={id} />
 */
export function AddToCollectionButton({ targetType, targetId, label = "Add to collection", variant = "secondary", size = "sm", iconOnly, className }: { targetType: CollectionTargetType; targetId: string; label?: string; variant?: "secondary" | "ghost" | "outline" | "gold"; size?: "sm" | "md" | "icon"; iconOnly?: boolean; className?: string }) {
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<CollectionDto[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [added, setAdded] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");

  async function load() {
    setError(null);
    setItems(null);
    try {
      const res = await api<{ items: CollectionDto[] }>("/api/collections");
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }
  function openSheet() {
    setOpen(true);
    void load();
  }
  async function add(id: string) {
    setBusy(id);
    try {
      const res = await api<{ added: boolean }>(`/api/collections/${id}/items`, { method: "POST", json: { targetType, targetId } });
      setAdded((s) => new Set(s).add(id));
      toast.push(res.added ? "Added to collection" : "Already in that collection", "success");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not add", "error");
    } finally {
      setBusy(null);
    }
  }
  async function create() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await api<{ collection: CollectionDto }>("/api/collections", { method: "POST", json: { name: name.trim() } });
      setItems((list) => [res.collection, ...(list ?? [])]);
      setName("");
      await add(res.collection.id);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not create", "error");
    } finally {
      setCreating(false);
    }
  }
  return (
    <>
      <Button variant={variant} size={iconOnly ? "icon" : size} className={className} onClick={(e) => { e.preventDefault(); e.stopPropagation(); openSheet(); }} aria-label={label}>
        <FolderPlus className="h-3.5 w-3.5" /> {!iconOnly && label}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Add to collection">
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New collection name" maxLength={60} aria-label="New collection name" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void create(); } }} />
            <Button variant="secondary" loading={creating} onClick={create} disabled={!name.trim()} aria-label="Create collection">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {error ? (
            <div className="space-y-2 text-center text-sm text-danger">
              {error}
              <Button variant="secondary" size="sm" className="mx-auto block" onClick={load}>Try again</Button>
            </div>
          ) : items === null ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : items.length === 0 ? (
            <p className="text-center text-sm text-muted">No collections yet. Create one above.</p>
          ) : (
            <ul className="max-h-[50dvh] space-y-1.5 overflow-y-auto">
              {items.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => add(c.id)} disabled={busy === c.id} className="flex w-full items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5 text-left text-sm transition hover:bg-surface-3 focus-ring disabled:opacity-60">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-fg">{c.name}</span>
                      <span className="block text-xs text-muted">{c.itemCount} item{c.itemCount === 1 ? "" : "s"}</span>
                    </span>
                    {added.has(c.id) ? <Check className="h-4 w-4 text-success" aria-label="Added" /> : <Plus className="h-4 w-4 text-muted" aria-hidden />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Sheet>
    </>
  );
}
