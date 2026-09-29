"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, BookOpen, Dices, Images, Layers, Pencil, Trash2, X } from "lucide-react";
import { Avatar, Button, EmptyState, ErrorState, Field, Input, Sheet, Skeleton, Textarea, useToast } from "@/components/ui";
import { CharacterCard } from "@/components/character/character-card";
import type { CollectionDto, CollectionItemDto, ComicItem, EncounterItem, ImageItem, StoryItem } from "@/lib/blackbook";
import type { CharacterCard as Card } from "@/lib/characters";
import { api } from "@/lib/offline/client";
import { ConfirmSheet } from "./confirm-sheet";
import { useResource } from "./use-resource";

type Detail = { collection: CollectionDto; items: CollectionItemDto[] };

export function CollectionDetail({ id, blur }: { id: string; blur: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useResource<Detail>(`/api/collections/${id}`);
  const [edit, setEdit] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [reorder, setReorder] = React.useState(false);

  if (loading) return <div className="space-y-3" aria-busy="true"><Skeleton className="h-8 w-1/2" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4] w-full" />)}</div></div>;
  if (error || !data) return <ErrorState description={error ?? undefined} onRetry={reload} />;
  const { collection, items } = data;

  async function saveMeta() {
    setSaving(true);
    try {
      const res = await api<{ collection: CollectionDto }>(`/api/collections/${id}`, { method: "PUT", json: { name: name.trim(), description: description.trim() } });
      setData((d) => (d ? { ...d, collection: res.collection } : d));
      setEdit(false);
      toast.push("Saved", "success");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    setSaving(true);
    try {
      await api(`/api/collections/${id}`, { method: "DELETE" });
      toast.push("Collection deleted", "success");
      router.replace("/blackbook/collections");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not delete", "error");
      setSaving(false);
    }
  }
  async function removeItem(it: CollectionItemDto) {
    const prev = items;
    setData((d) => (d ? { ...d, items: d.items.filter((x) => !(x.targetType === it.targetType && x.targetId === it.targetId)), collection: { ...d.collection, itemCount: d.collection.itemCount - 1 } } : d));
    try {
      await api(`/api/collections/${id}/items?targetType=${it.targetType}&targetId=${encodeURIComponent(it.targetId)}`, { method: "DELETE" });
    } catch (err) {
      setData((d) => (d ? { ...d, items: prev, collection: { ...d.collection, itemCount: prev.length } } : d));
      toast.push(err instanceof Error ? err.message : "Could not remove", "error");
    }
  }
  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setData((d) => (d ? { ...d, items: next } : d));
    try {
      await api(`/api/collections/${id}/items/reorder`, { method: "PUT", json: { order: next.map((x) => ({ targetType: x.targetType, targetId: x.targetId })) } });
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not reorder", "error");
      void reload();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl leading-tight">{collection.name}</h1>
          <p className="text-xs text-muted">{collection.itemCount} item{collection.itemCount === 1 ? "" : "s"}{collection.description ? ` · ${collection.description}` : ""}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon" aria-label="Rename collection" onClick={() => { setName(collection.name); setDescription(collection.description); setEdit(true); }}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="text-danger" aria-label="Delete collection" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      {items.length === 0 ? (
        <EmptyState title="Empty collection" description="Use “Add to collection” on any character, story, comic, image or saved encounter." action={<Button href="/explore" variant="secondary">Explore</Button>} />
      ) : (
        <>
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setReorder((r) => !r)} aria-pressed={reorder}>{reorder ? "Done" : "Reorder"}</Button>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((it, i) => (
              <li key={`${it.targetType}:${it.targetId}`} className="relative space-y-1.5">
                <ItemView it={it} blur={blur} />
                <div className="flex gap-1">
                  {reorder && (
                    <>
                      <Button variant="secondary" size="icon" className="h-8 w-8 rounded-lg" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                      <Button variant="secondary" size="icon" className="h-8 w-8 rounded-lg" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                    </>
                  )}
                  <Button variant="ghost" size="sm" className="ml-auto h-8 text-danger" onClick={() => removeItem(it)} aria-label="Remove from collection"><X className="h-3.5 w-3.5" /> Remove</Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <Sheet open={edit} onClose={() => setEdit(false)} title="Edit collection">
        <div className="space-y-4">
          <Field label="Name" required><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
          <Field label="Description"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={2} className="min-h-[60px]" /></Field>
          <Button className="w-full" loading={saving} disabled={!name.trim()} onClick={saveMeta}>Save</Button>
        </div>
      </Sheet>
      <ConfirmSheet open={confirmDelete} title="Delete collection?" body={<>“{collection.name}” will be deleted. The items themselves are untouched.</>} confirmLabel="Delete" danger loading={saving} onClose={() => setConfirmDelete(false)} onConfirm={remove} />
    </div>
  );
}

function ItemView({ it, blur }: { it: CollectionItemDto; blur: boolean }) {
  if (!it.item) return <div className="card flex aspect-[3/4] items-center justify-center p-3 text-center text-xs text-muted">This {it.targetType.toLowerCase()} is no longer available.</div>;
  switch (it.targetType) {
    case "CHARACTER":
      return <CharacterCard c={it.item as Card} blur={blur} compactMode />;
    case "IMAGE": {
      const im = it.item as ImageItem;
      return (
        <Link href={`/gallery/${im.id}`} className="card card-hover block overflow-hidden focus-ring">
          <div className="relative aspect-[3/4] w-full bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={im.url} alt={im.title || "Image"} className={`h-full w-full object-cover ${blur ? "blur-nsfw" : ""}`} loading="lazy" />
          </div>
          <p className="truncate p-2 text-xs">{im.title || "Untitled"}</p>
        </Link>
      );
    }
    case "COMIC": {
      const c = it.item as ComicItem;
      return (
        <Link href={`/comics/${c.id}`} className="card card-hover block overflow-hidden focus-ring">
          <div className="relative aspect-[3/4] w-full bg-surface-2">
            {c.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.coverUrl} alt="" className={`h-full w-full object-cover ${blur ? "blur-nsfw" : ""}`} loading="lazy" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted"><Layers className="h-8 w-8" /></div>
            )}
          </div>
          <p className="truncate p-2 text-xs">{c.title} · {c.pageCount}p</p>
        </Link>
      );
    }
    case "STORY": {
      const s = it.item as StoryItem;
      return (
        <Link href={`/stories/${s.id}`} className="card card-hover flex aspect-[3/4] flex-col justify-between p-3 focus-ring">
          <BookOpen className="h-5 w-5 text-accent-2" aria-hidden />
          <span>
            <span className="line-clamp-2 font-display text-sm leading-tight text-fg">{s.title}</span>
            <span className="mt-1 line-clamp-3 text-[11px] text-muted">{s.summary || `${s.wordCount} words`}</span>
          </span>
        </Link>
      );
    }
    case "ENCOUNTER": {
      const e = it.item as EncounterItem;
      return (
        <Link href="/blackbook/encounters" className="card card-hover flex aspect-[3/4] flex-col justify-between p-3 focus-ring">
          <div className="flex items-center justify-between"><Dices className="h-5 w-5 text-gold" aria-hidden /><Avatar name={e.character.name} seed={e.character.avatarSeed} src={e.character.avatarUrl} size={28} rounded="rounded-lg" /></div>
          <span>
            <span className="line-clamp-2 font-display text-sm leading-tight text-fg">{e.name}</span>
            <span className="mt-1 line-clamp-3 text-[11px] text-muted">with {e.character.name}</span>
          </span>
        </Link>
      );
    }
    default:
      return <div className="card flex aspect-[3/4] items-center justify-center text-muted"><Images className="h-6 w-6" /></div>;
  }
}
