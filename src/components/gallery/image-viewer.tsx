"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Globe, Info, Layers, Lock, MessageCircle, MoreHorizontal, Pencil, Shuffle, Trash2, X } from "lucide-react";
import { Avatar, BlurGuard, Button, Field, Input, IntensityBadge, Sheet, Toggle, useToast } from "@/components/ui";
import { ReportButton } from "@/components/character/report-button";
import { AddToCollectionButton } from "@/components/blackbook/add-to-collection";
import { ReactionBar, type ReactionKind } from "@/components/content/reaction-bar";
import { ContentFavoriteButton } from "@/components/content/content-favorite-button";
import { PublishDialog } from "@/components/content/publish-dialog";
import { FollowButton } from "@/components/content/follow-button";
import { ShareButton } from "@/components/content/share-button";
import { ReviewNotice, StatusPill } from "@/components/content/status";
import { IntensityPicker, TagInput } from "@/components/content/pickers";
import type { ImageDetail } from "@/lib/images";
import { ART_STYLES, TAGS, THEMES } from "@/lib/constants";
import { api, ApiClientError } from "@/lib/offline/client";
import { cn, compact, timeAgo } from "@/lib/utils";

type Viewer = { id: string; displayName: string; blur: boolean; maxIntensity: number };

export function ImageViewer({ initial, viewer }: { initial: ImageDetail; viewer: Viewer }) {
  const router = useRouter();
  const toast = useToast();
  const [img, setImg] = React.useState(initial);
  const [panel, setPanel] = React.useState(true);
  const [details, setDetails] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const isOwner = img.isOwner;
  const published = img.status === "PUBLISHED" && img.visibility === "PUBLIC";
  const canRemix = isOwner || (img.allowRemix && published);

  React.useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !editOpen && !publishOpen && !menuOpen && !deleteOpen && close();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOpen, publishOpen, menuOpen, deleteOpen]);

  function close() {
    if (window.history.length > 1) router.back();
    else router.push("/gallery");
  }
  function fail(err: unknown, fallback: string) {
    toast.push(err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : fallback, "error");
  }
  async function variations() {
    setBusy("vary");
    try {
      const res = await api<{ items: { id: string; url: string }[] }>(`/api/images/${img.id}/variations`, { method: "POST", json: { count: 2 } });
      toast.push("Variations generated — find them in My generations.", "success");
      router.push(`/gallery/${res.items[0].id}`);
    } catch (err) {
      fail(err, "Could not generate variations");
    } finally {
      setBusy(null);
    }
  }
  async function remove() {
    setBusy("delete");
    try {
      await api(`/api/images/${img.id}`, { method: "DELETE" });
      toast.push("Image deleted", "success");
      router.replace("/gallery?view=mine");
    } catch (err) {
      fail(err, "Could not delete");
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label={img.title || "Image"}>
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 px-3 pt-[calc(0.5rem+var(--safe-top))]">
        <button type="button" onClick={close} className="rounded-full bg-white/10 p-2 focus-ring" aria-label="Close"><X className="h-5 w-5" /></button>
        <div className="flex items-center gap-1">
          <IntensityBadge level={img.intensity} />
          {isOwner && <StatusPill status={img.status} visibility={img.visibility} modStatus={img.modStatus} />}
          <button type="button" onClick={() => setMenuOpen(true)} className="rounded-full bg-white/10 p-2 focus-ring" aria-label="More actions"><MoreHorizontal className="h-5 w-5" /></button>
        </div>
      </div>

      {/* Image */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-2" onClick={() => setPanel((p) => !p)}>
        <BlurGuard enabled={viewer.blur && img.intensity >= 2 && !isOwner} label="Tap to reveal" className="max-h-full max-w-full rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.url} alt={img.title || "Generated image"} className="max-h-[calc(100dvh-8rem)] max-w-full rounded-lg object-contain" />
        </BlurGuard>
      </div>

      {/* Bottom panel */}
      <div className={cn("glass shrink-0 rounded-t-3xl border-t border-white/10 px-4 pb-[calc(0.75rem+var(--safe-bottom))] pt-3 text-fg transition-transform", !panel && "translate-y-[calc(100%-2.75rem)]")}>
        <button type="button" onClick={() => setPanel((p) => !p)} className="mx-auto mb-2 flex items-center gap-1 text-xs text-muted focus-ring rounded" aria-expanded={panel}>
          {panel ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />} {panel ? "Hide" : "Show details"}
        </button>
        <div className="max-h-[42dvh] space-y-3 overflow-y-auto">
          {isOwner && <ReviewNotice modStatus={img.modStatus} />}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-lg leading-tight">{img.title || "Untitled"}</h1>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                <Avatar name={img.owner.displayName} seed={img.owner.id} size={20} rounded="rounded-full" />
                <span className="text-fg-2">{img.owner.displayName}</span>
                <span>· {img.style} · {compact(img.viewCount)} views · {timeAgo(img.publishedAt ?? img.createdAt)}</span>
              </div>
            </div>
            {!isOwner ? <FollowButton userId={img.owner.id} initial={img.isFollowing} /> : !published && img.modStatus === "ACTIVE" && <Button size="sm" onClick={() => setPublishOpen(true)}><Globe className="h-3.5 w-3.5" /> Publish</Button>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ReactionBar type="image" id={img.id} initial={img.reaction as ReactionKind | null} counts={img.reactions} compactMode />
            <ContentFavoriteButton type="image" id={img.id} initial={img.isFavorite} count={img.saveCount} />
            <AddToCollectionButton targetType="IMAGE" targetId={img.id} />
            <ShareButton path={`/gallery/${img.id}`} enabled={published} />
            {canRemix && <Button variant="gold" size="sm" href={`/gallery/new?remix=${img.id}`}><Shuffle className="h-3.5 w-3.5" /> Remix</Button>}
            {isOwner && <Button variant="secondary" size="sm" loading={busy === "vary"} onClick={variations}><Layers className="h-3.5 w-3.5" /> Variations</Button>}
            {!isOwner && <ReportButton targetType="IMAGE" targetId={img.id} />}
          </div>

          {img.character && (
            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-2.5">
              <Avatar name={img.character.name} seed={img.character.avatarSeed} src={img.character.avatarUrl} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{img.character.name}</p>
                <p className="text-[11px] text-muted">Featured character</p>
              </div>
              <Button variant="outline" size="sm" href={`/character/${img.character.id}`}><MessageCircle className="h-3.5 w-3.5" /> Chat with {img.character.name.split(" ")[0]}</Button>
            </div>
          )}

          {img.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {img.tags.map((t) => (
                <span key={t} className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] text-fg-2">#{t}</span>
              ))}
            </div>
          )}

          {img.details && (
            <div className="rounded-xl border border-line bg-surface-2">
              <button type="button" onClick={() => setDetails((d) => !d)} className="flex w-full items-center justify-between px-3 py-2 text-sm focus-ring" aria-expanded={details}>
                <span className="inline-flex items-center gap-2"><Info className="h-4 w-4 text-muted" /> Generation details</span>
                {details ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {details && (
                <dl className="space-y-2 border-t border-line px-3 py-3 text-xs">
                  <div><dt className="text-muted">Prompt</dt><dd className="mt-0.5 whitespace-pre-wrap text-fg-2">{img.details.prompt || "—"}</dd></div>
                  {img.details.negativePrompt && <div><dt className="text-muted">Negative prompt</dt><dd className="mt-0.5 text-fg-2">{img.details.negativePrompt}</dd></div>}
                  <div className="grid grid-cols-3 gap-2">
                    <div><dt className="text-muted">Style</dt><dd className="text-fg-2">{img.style}</dd></div>
                    <div><dt className="text-muted">Seed</dt><dd className="text-fg-2">{img.details.seed}</dd></div>
                    <div><dt className="text-muted">Model</dt><dd className="truncate text-fg-2">{img.details.provider}/{img.details.model}</dd></div>
                  </div>
                  {img.parentImageId && <div><dt className="text-muted">Remixed from</dt><dd><a href={`/gallery/${img.parentImageId}`} className="text-accent-2 hover:underline">original image</a></dd></div>}
                  {!img.showDetails && isOwner && <p className="text-muted">Only you can see these; turn on &ldquo;show details&rdquo; to share them.</p>}
                </dl>
              )}
            </div>
          )}
        </div>
      </div>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Image">
        <div className="space-y-1.5">
          <a href={img.url} download className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-fg hover:bg-surface-2 focus-ring"><Layers className="h-4 w-4 text-muted" /> Download image</a>
          {isOwner && (
            <>
              <button onClick={() => { setMenuOpen(false); setEditOpen(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-fg hover:bg-surface-2 focus-ring"><Pencil className="h-4 w-4 text-muted" /> Edit title, tags & settings</button>
              <button onClick={() => { setMenuOpen(false); setPublishOpen(true); }} disabled={img.modStatus !== "ACTIVE"} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-fg hover:bg-surface-2 focus-ring disabled:opacity-50">
                {published ? <Lock className="h-4 w-4 text-muted" /> : <Globe className="h-4 w-4 text-muted" />} {published ? "Keep private (unpublish)" : "Publish"}
              </button>
              <button onClick={() => { setMenuOpen(false); setDeleteOpen(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-danger hover:bg-danger/10 focus-ring"><Trash2 className="h-4 w-4" /> Delete image</button>
            </>
          )}
        </div>
      </Sheet>

      {editOpen && <EditSheet img={img} maxIntensity={viewer.maxIntensity} onClose={() => setEditOpen(false)} onSaved={(d) => { setImg(d); setEditOpen(false); }} />}
      <PublishDialog<ImageDetail> open={publishOpen} onClose={() => setPublishOpen(false)} kind="image" id={img.id} title={img.title || "Untitled image"} displayName={viewer.displayName} published={published} showDetails={img.showDetails} onDone={setImg} />
      <Sheet open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete this image?">
        <p className="text-sm text-fg-2">This permanently deletes the image and its file. This can&apos;t be undone.</p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="danger" className="flex-1" loading={busy === "delete"} onClick={remove}>Delete</Button>
        </div>
      </Sheet>
    </div>
  );
}

function EditSheet({ img, maxIntensity, onClose, onSaved }: { img: ImageDetail; maxIntensity: number; onClose: () => void; onSaved: (d: ImageDetail) => void }) {
  const toast = useToast();
  const [title, setTitle] = React.useState(img.title);
  const [tags, setTags] = React.useState(img.tags);
  const [intensity, setIntensity] = React.useState(img.intensity);
  const [showDetails, setShowDetails] = React.useState(img.showDetails);
  const [allowRemix, setAllowRemix] = React.useState(img.allowRemix);
  const [saving, setSaving] = React.useState(false);
  async function save() {
    setSaving(true);
    try {
      const d = await api<ImageDetail>(`/api/images/${img.id}`, { method: "PUT", json: { title, tags, intensity, showDetails, allowRemix } });
      toast.push("Saved", "success");
      onSaved(d);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Sheet open onClose={onClose} title="Edit image">
      <div className="space-y-4">
        <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></Field>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Intensity</p>
          <IntensityPicker value={intensity} onChange={setIntensity} max={maxIntensity} />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Tags</p>
          <TagInput value={tags} onChange={setTags} suggestions={[...THEMES, ...TAGS, ...ART_STYLES]} max={12} />
        </div>
        <Toggle checked={showDetails} onChange={setShowDetails} label="Show generation details" description="Prompt, negative prompt, seed and model are visible to viewers." />
        <Toggle checked={allowRemix} onChange={setAllowRemix} label="Allow remixing" description="Others can start from your prompt and seed." />
        <Button className="w-full" loading={saving} onClick={save}>Save</Button>
      </div>
    </Sheet>
  );
}
