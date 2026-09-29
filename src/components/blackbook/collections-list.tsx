"use client";
import * as React from "react";
import Link from "next/link";
import { ChevronRight, FolderHeart, Plus } from "lucide-react";
import { Button, EmptyState, ErrorState, Field, Input, Sheet, Skeleton, Textarea, useToast } from "@/components/ui";
import type { CollectionDto } from "@/lib/blackbook";
import { api } from "@/lib/offline/client";
import { timeAgo } from "@/lib/utils";
import { useResource } from "./use-resource";

export function CollectionsList() {
  const toast = useToast();
  const { data, loading, error, reload, setData } = useResource<{ items: CollectionDto[] }>("/api/collections");
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function create() {
    setSaving(true);
    try {
      const res = await api<{ collection: CollectionDto }>("/api/collections", { method: "POST", json: { name: name.trim(), description: description.trim() } });
      setData((d) => ({ items: [res.collection, ...(d?.items ?? [])] }));
      setOpen(false);
      setName("");
      setDescription("");
      toast.push("Collection created", "success");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not create", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button size="sm" onClick={() => setOpen(true)} className="w-full sm:w-auto">
        <Plus className="h-4 w-4" /> New collection
      </Button>
      {loading ? (
        <div className="space-y-2" aria-busy="true">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full !rounded-2xl" />)}</div>
      ) : error || !data ? (
        <ErrorState description={error ?? undefined} onRetry={reload} />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<FolderHeart className="h-8 w-8" />} title="No collections yet" description="Group characters, stories, comics, images and encounters however you like." />
      ) : (
        <ul className="space-y-2">
          {data.items.map((c) => (
            <li key={c.id}>
              <Link href={`/blackbook/collections/${c.id}`} className="card card-hover fade-up flex items-center gap-3 p-3 focus-ring">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-2"><FolderHeart className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-fg">{c.name}</span>
                  <span className="block truncate text-xs text-muted">{c.itemCount} item{c.itemCount === 1 ? "" : "s"} · {timeAgo(c.updatedAt)}{c.description ? ` · ${c.description}` : ""}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="New collection">
        <div className="space-y-4">
          <Field label="Name" required><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Rainy-night reads" autoFocus /></Field>
          <Field label="Description"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={2} className="min-h-[60px]" /></Field>
          <Button className="w-full" loading={saving} disabled={!name.trim()} onClick={create}>Create</Button>
        </div>
      </Sheet>
    </div>
  );
}
