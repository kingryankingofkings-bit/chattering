"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Globe, ImageDown, Lock, Maximize2, Minimize2, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2, Wand2, X } from "lucide-react";
import { BlurGuard, Button, Field, Input, IntensityBadge, Sheet, Textarea, useToast } from "@/components/ui";
import { ReportButton } from "@/components/character/report-button";
import { AddToCollectionButton } from "@/components/blackbook/add-to-collection";
import { ReactionBar, type ReactionKind } from "@/components/content/reaction-bar";
import { ContentFavoriteButton } from "@/components/content/content-favorite-button";
import { PublishDialog } from "@/components/content/publish-dialog";
import { FollowButton } from "@/components/content/follow-button";
import { ShareButton } from "@/components/content/share-button";
import { CharacterLinks } from "@/components/content/character-links";
import { ReviewNotice, StatusPill } from "@/components/content/status";
import { IntensityPicker, TagInput } from "@/components/content/pickers";
import { ComicPageView } from "./comic-page-view";
import type { ComicDetail } from "@/lib/comics";
import type { ComicPage, ComicPanel } from "@/lib/types";
import { TAGS, THEMES } from "@/lib/constants";
import { api, ApiClientError } from "@/lib/offline/client";
import { cn, compact, timeAgo } from "@/lib/utils";

type Viewer = { id: string; displayName: string; blur: boolean; maxIntensity: number };

export function ComicReader({ initial, viewer }: { initial: ComicDetail; viewer: Viewer }) {
  const router = useRouter();
  const toast = useToast();
  const [comic, setComic] = React.useState(initial);
  const [page, setPage] = React.useState(0);
  const [full, setFull] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null); // "page" | "continue" | panelId | "save" | "delete"
  const [panelSheet, setPanelSheet] = React.useState<ComicPanel | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const touchX = React.useRef<number | null>(null);
  const isOwner = comic.isOwner;
  const pages = comic.pages;
  const current = pages[Math.min(page, pages.length - 1)];
  const published = comic.status === "PUBLISHED" && comic.visibility === "PUBLIC";

  const go = React.useCallback((delta: number) => setPage((p) => Math.max(0, Math.min(pages.length - 1, p + delta))), [pages.length]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (panelSheet || detailsOpen || publishOpen) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "Escape" && full) setFull(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, full, panelSheet, detailsOpen, publishOpen]);

  React.useEffect(() => {
    if (!full) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [full]);

  function fail(err: unknown, fallback: string) {
    toast.push(err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : fallback, "error");
  }

  /* ---------- owner actions ---------- */
  async function savePages(next: ComicPage[], successMsg = "Saved") {
    setBusy("save");
    try {
      const d = await api<ComicDetail>(`/api/comics/${comic.id}/pages`, { method: "PUT", json: { pages: next } });
      setComic(d);
      toast.push(successMsg, "success");
      return true;
    } catch (err) {
      fail(err, "Could not save");
      return false;
    } finally {
      setBusy(null);
    }
  }
  async function regeneratePanel(panelId: string, imagePrompt?: string) {
    setBusy(panelId);
    try {
      const d = await api<ComicDetail>(`/api/comics/${comic.id}/panels/${panelId}/regenerate`, { method: "POST", json: { imagePrompt } });
      setComic(d);
      setPanelSheet(null);
      toast.push("Panel redrawn", "success");
    } catch (err) {
      fail(err, "Could not redraw the panel");
    } finally {
      setBusy(null);
    }
  }
  async function regeneratePage() {
    if (!current) return;
    setBusy("page");
    try {
      const d = await api<ComicDetail>(`/api/comics/${comic.id}/pages/${current.id}/regenerate`, { method: "POST" });
      setComic(d);
      toast.push("Page regenerated", "success");
    } catch (err) {
      fail(err, "Could not regenerate the page");
    } finally {
      setBusy(null);
    }
  }
  async function continueStory() {
    setBusy("continue");
    try {
      const d = await api<ComicDetail>(`/api/comics/${comic.id}/continue`, { method: "POST", json: {} });
      setComic(d);
      setPage(d.pages.length - 1);
      toast.push("New page added", "success");
    } catch (err) {
      fail(err, "Could not continue the story");
    } finally {
      setBusy(null);
    }
  }
  async function movePage(delta: number) {
    const i = page;
    const j = i + delta;
    if (j < 0 || j >= pages.length) return;
    const next = [...pages];
    [next[i], next[j]] = [next[j], next[i]];
    if (await savePages(next, "Pages reordered")) setPage(j);
  }
  async function removePage() {
    if (pages.length <= 1) return toast.push("A comic needs at least one page.");
    const next = pages.filter((_, i) => i !== page);
    if (await savePages(next, "Page removed")) setPage(Math.max(0, page - 1));
  }
  async function deleteComic() {
    setBusy("delete");
    try {
      await api(`/api/comics/${comic.id}`, { method: "DELETE" });
      toast.push("Comic deleted", "success");
      router.replace("/comics?view=mine");
    } catch (err) {
      fail(err, "Could not delete");
      setBusy(null);
    }
  }

  const blurAll = viewer.blur && comic.intensity >= 2 && !isOwner;

  const pageEl = current ? (
    <BlurGuard enabled={blurAll} label="Tap to reveal this page" className="rounded-xl">
      <ComicPageView page={current} layout={comic.panelLayout} orientation={comic.orientation} editable={editing} onEditPanel={setPanelSheet} busyPanelId={busy} className={cn(busy === "page" && "opacity-50")} />
    </BlurGuard>
  ) : (
    <div className="card p-8 text-center text-sm text-muted">This comic has no pages.</div>
  );

  const nav = (
    <div className="flex items-center justify-between gap-2">
      <Button variant="ghost" size="icon" onClick={() => go(-1)} disabled={page === 0} aria-label="Previous page"><ChevronLeft className="h-5 w-5" /></Button>
      <div className="flex items-center gap-1.5" role="tablist" aria-label="Pages">
        {pages.map((p, i) => (
          <button key={p.id} role="tab" aria-selected={i === page} aria-label={`Page ${i + 1}`} onClick={() => setPage(i)} className={cn("h-2 rounded-full transition-all focus-ring", i === page ? "w-6 bg-accent" : "w-2 bg-line-2 hover:bg-fg-2")} />
        ))}
        <span className="ml-2 text-xs text-muted">{page + 1} / {pages.length}</span>
      </div>
      <Button variant="ghost" size="icon" onClick={() => go(1)} disabled={page >= pages.length - 1} aria-label="Next page"><ChevronRight className="h-5 w-5" /></Button>
    </div>
  );

  const swipe = {
    onTouchStart: (e: React.TouchEvent) => (touchX.current = e.touches[0].clientX),
    onTouchEnd: (e: React.TouchEvent) => {
      if (touchX.current === null) return;
      const dx = e.changedTouches[0].clientX - touchX.current;
      touchX.current = null;
      if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
    },
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl leading-tight">{comic.title}</h1>
            <IntensityBadge level={comic.intensity} />
            {isOwner && <StatusPill status={comic.status} visibility={comic.visibility} modStatus={comic.modStatus} />}
          </div>
          <p className="mt-1 text-xs text-muted">
            by <span className="text-fg-2">{comic.author.displayName}</span> · {comic.pageCount} page{comic.pageCount === 1 ? "" : "s"} · {comic.artStyle} · {compact(comic.viewCount)} views · {timeAgo(comic.publishedAt ?? comic.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          {!isOwner && <FollowButton userId={comic.author.id} initial={comic.isFollowing} />}
          {isOwner && (
            <Button variant={editing ? "primary" : "secondary"} size="sm" onClick={() => setEditing((e) => !e)} aria-pressed={editing}>
              {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />} {editing ? "Done" : "Edit"}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setMenuOpen(true)} aria-label="More actions"><MoreHorizontal className="h-5 w-5" /></Button>
        </div>
      </div>
      {isOwner && <ReviewNotice modStatus={comic.modStatus} />}
      {isOwner && !published && comic.modStatus === "ACTIVE" && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm">
          <span className="flex items-center gap-2 text-fg-2"><Lock className="h-4 w-4 text-accent-2" /> Private draft. Only you can see this.</span>
          <Button size="sm" onClick={() => setPublishOpen(true)}><Globe className="h-3.5 w-3.5" /> Publish</Button>
        </div>
      )}

      {/* Reader */}
      <div className="space-y-2" {...swipe}>
        <div className="relative">
          {pageEl}
          <button type="button" onClick={() => setFull(true)} className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white focus-ring" aria-label="Full screen"><Maximize2 className="h-4 w-4" /></button>
        </div>
        {nav}
      </div>

      {/* Editor toolbar */}
      {isOwner && editing && (
        <div className="card space-y-3 p-3">
          <p className="text-xs text-muted">Tap a panel to edit its caption, dialogue or redraw it.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={regeneratePage} loading={busy === "page"}><RefreshCw className="h-3.5 w-3.5" /> Regenerate page</Button>
            <Button variant="secondary" size="sm" onClick={continueStory} loading={busy === "continue"}><Plus className="h-3.5 w-3.5" /> Continue the story</Button>
            <Button variant="ghost" size="sm" onClick={() => movePage(-1)} disabled={page === 0 || busy === "save"} aria-label="Move page earlier"><ArrowUp className="h-3.5 w-3.5" /> Earlier</Button>
            <Button variant="ghost" size="sm" onClick={() => movePage(1)} disabled={page >= pages.length - 1 || busy === "save"} aria-label="Move page later"><ArrowDown className="h-3.5 w-3.5" /> Later</Button>
            <Button variant="ghost" size="sm" onClick={removePage} disabled={pages.length <= 1 || busy === "save"}><Trash2 className="h-3.5 w-3.5" /> Remove page</Button>
            <Button variant="ghost" size="sm" onClick={() => setDetailsOpen(true)}><Pencil className="h-3.5 w-3.5" /> Title & details</Button>
          </div>
        </div>
      )}

      {/* Viewer actions */}
      <div className="flex flex-wrap items-center gap-2">
        <ReactionBar type="comic" id={comic.id} initial={comic.reaction as ReactionKind | null} counts={comic.reactions} />
        <ContentFavoriteButton type="comic" id={comic.id} initial={comic.isFavorite} count={comic.favoriteCount} />
        <AddToCollectionButton targetType="COMIC" targetId={comic.id} />
        <ShareButton path={`/comics/${comic.id}`} enabled={published} />
        {!isOwner && <ReportButton targetType="COMIC" targetId={comic.id} />}
      </div>

      <p className="text-sm leading-relaxed text-fg-2">{comic.premise}</p>
      {comic.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {comic.tags.map((t) => (
            <span key={t} className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] text-fg-2">#{t}</span>
          ))}
        </div>
      )}
      <CharacterLinks characters={comic.characters} context={{ version: 1, origin: "comic", hook: comic.premise.slice(0, 500) }} />

      {/* Full-screen overlay */}
      {full && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="Full-screen reader" {...swipe}>
          <div className="flex items-center justify-between px-3 pt-[calc(0.5rem+var(--safe-top))]">
            <span className="truncate text-sm text-white/80">{comic.title}</span>
            <button type="button" onClick={() => setFull(false)} className="rounded-full bg-white/10 p-2 text-white focus-ring" aria-label="Exit full screen"><Minimize2 className="h-4 w-4" /></button>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-auto p-2">
            <div className="w-full max-w-2xl">{pageEl}</div>
          </div>
          <div className="px-3 pb-[calc(0.75rem+var(--safe-bottom))] text-white">{nav}</div>
        </div>
      )}

      {/* Panel edit sheet */}
      {panelSheet && (
        <PanelEditor
          key={panelSheet.id}
          panel={panelSheet}
          busy={busy === panelSheet.id}
          onClose={() => setPanelSheet(null)}
          onSave={async (p) => {
            const next = pages.map((pg) => ({ ...pg, panels: pg.panels.map((x) => (x.id === p.id ? p : x)) }));
            if (await savePages(next)) setPanelSheet(null);
          }}
          onRedraw={(prompt) => regeneratePanel(panelSheet.id, prompt)}
        />
      )}

      {/* Details sheet */}
      {detailsOpen && <DetailsEditor comic={comic} maxIntensity={viewer.maxIntensity} onClose={() => setDetailsOpen(false)} onSaved={(d) => { setComic(d); setDetailsOpen(false); }} />}

      <PublishDialog<ComicDetail> open={publishOpen} onClose={() => setPublishOpen(false)} kind="comic" id={comic.id} title={comic.title} displayName={viewer.displayName} published={published} onDone={setComic} />

      {/* Actions menu */}
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Comic">
        <div className="space-y-1.5">
          <a href={`/api/comics/${comic.id}/export`} download className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-fg hover:bg-surface-2 focus-ring"><Download className="h-4 w-4 text-muted" /> Download script (JSON)</a>
          {current?.panels.map((p, i) => p.mediaId && (
            <a key={p.id} href={`/api/media/${p.mediaId}`} download={`${comic.title}-p${page + 1}-${i + 1}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-fg hover:bg-surface-2 focus-ring"><ImageDown className="h-4 w-4 text-muted" /> Download page {page + 1}, panel {i + 1}</a>
          ))}
          {isOwner && (
            <>
              <button onClick={() => { setMenuOpen(false); setPublishOpen(true); }} disabled={comic.modStatus !== "ACTIVE"} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-fg hover:bg-surface-2 focus-ring disabled:opacity-50">
                {published ? <Lock className="h-4 w-4 text-muted" /> : <Globe className="h-4 w-4 text-muted" />} {published ? "Keep private (unpublish)" : "Publish"}
              </button>
              <button onClick={() => { setMenuOpen(false); setDetailsOpen(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-fg hover:bg-surface-2 focus-ring"><Pencil className="h-4 w-4 text-muted" /> Edit title, premise & tags</button>
              <button onClick={() => { setMenuOpen(false); setDeleteOpen(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-danger hover:bg-danger/10 focus-ring"><Trash2 className="h-4 w-4" /> Delete comic</button>
            </>
          )}
        </div>
      </Sheet>

      <Sheet open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete this comic?">
        <p className="text-sm text-fg-2">This permanently deletes the comic and all of its panel images. This can&apos;t be undone.</p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="danger" className="flex-1" loading={busy === "delete"} onClick={deleteComic}>Delete</Button>
        </div>
      </Sheet>
    </div>
  );
}

function PanelEditor({ panel, busy, onClose, onSave, onRedraw }: { panel: ComicPanel; busy: boolean; onClose: () => void; onSave: (p: ComicPanel) => Promise<void>; onRedraw: (imagePrompt?: string) => void }) {
  const [draft, setDraft] = React.useState<ComicPanel>(panel);
  const [saving, setSaving] = React.useState(false);
  const [prevPanel, setPrevPanel] = React.useState(panel);
  if (panel !== prevPanel) {
    setPrevPanel(panel);
    setDraft(panel);
  }
  const dirtyPrompt = draft.imagePrompt !== panel.imagePrompt;
  return (
    <Sheet open onClose={onClose} title="Edit panel" wide>
      <div className="space-y-4">
        <div className="flex gap-3">
          {panel.mediaId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/media/${panel.mediaId}`} alt="" className="h-28 w-24 shrink-0 rounded-lg object-cover" />
          )}
          <div className="flex-1 space-y-2">
            <Field label="Image prompt" hint="What this panel shows. Changing it and redrawing generates a new image.">
              <Textarea value={draft.imagePrompt} onChange={(e) => setDraft({ ...draft, imagePrompt: e.target.value })} maxLength={800} className="min-h-[72px]" />
            </Field>
            <Button variant="secondary" size="sm" loading={busy} onClick={() => onRedraw(dirtyPrompt ? draft.imagePrompt : undefined)}><Wand2 className="h-3.5 w-3.5" /> Redraw panel</Button>
          </div>
        </div>
        <Field label="Caption">
          <Input value={draft.caption} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} maxLength={300} placeholder="Narration box (optional)" />
        </Field>
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Dialogue</p>
          {draft.dialogue.map((d, i) => (
            <div key={i} className="flex gap-2">
              <Input value={d.speaker} onChange={(e) => setDraft({ ...draft, dialogue: draft.dialogue.map((x, j) => (j === i ? { ...x, speaker: e.target.value } : x)) })} maxLength={60} placeholder="Speaker" aria-label={`Speaker ${i + 1}`} className="w-28 shrink-0" />
              <Input value={d.text} onChange={(e) => setDraft({ ...draft, dialogue: draft.dialogue.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} maxLength={300} placeholder="Line" aria-label={`Line ${i + 1}`} />
              <Button variant="ghost" size="icon" onClick={() => setDraft({ ...draft, dialogue: draft.dialogue.filter((_, j) => j !== i) })} aria-label="Remove line"><X className="h-4 w-4" /></Button>
            </div>
          ))}
          {draft.dialogue.length < 4 && <Button variant="ghost" size="sm" onClick={() => setDraft({ ...draft, dialogue: [...draft.dialogue, { speaker: "", text: "" }] })}><Plus className="h-3.5 w-3.5" /> Add line</Button>}
        </div>
        <Field label="Sound effects" hint="Comma separated, up to 3">
          <Input value={draft.sfx.join(", ")} onChange={(e) => setDraft({ ...draft, sfx: e.target.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3) })} placeholder="thrum, hush" />
        </Field>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" loading={saving} onClick={async () => { setSaving(true); await onSave({ ...draft, dialogue: draft.dialogue.filter((d) => d.text.trim()) }); setSaving(false); }}>Save panel</Button>
        </div>
      </div>
    </Sheet>
  );
}

function DetailsEditor({ comic, maxIntensity, onClose, onSaved }: { comic: ComicDetail; maxIntensity: number; onClose: () => void; onSaved: (d: ComicDetail) => void }) {
  const toast = useToast();
  const [title, setTitle] = React.useState(comic.title);
  const [premise, setPremise] = React.useState(comic.premise);
  const [tags, setTags] = React.useState(comic.tags);
  const [intensity, setIntensity] = React.useState(comic.intensity);
  const [saving, setSaving] = React.useState(false);
  async function save() {
    setSaving(true);
    try {
      const d = await api<ComicDetail>(`/api/comics/${comic.id}`, { method: "PUT", json: { title, premise, tags, intensity } });
      toast.push("Draft saved", "success");
      onSaved(d);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Sheet open onClose={onClose} title="Comic details">
      <div className="space-y-4">
        <Field label="Title" required><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></Field>
        <Field label="Premise"><Textarea value={premise} onChange={(e) => setPremise(e.target.value)} maxLength={2000} /></Field>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Intensity</p>
          <IntensityPicker value={intensity} onChange={setIntensity} max={maxIntensity} />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Tags</p>
          <TagInput value={tags} onChange={setTags} suggestions={[...THEMES, ...TAGS]} max={12} />
        </div>
        <Button className="w-full" loading={saving} disabled={!title.trim()} onClick={save}>Save draft</Button>
      </div>
    </Sheet>
  );
}
