"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, GitBranch, Globe, List, Lock, MoreHorizontal, Pencil, Plus, Trash2, Wand2, X } from "lucide-react";
import { Button, Chip, Field, Input, IntensityBadge, Select, Sheet, Textarea, useToast } from "@/components/ui";
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
import { readingMinutes } from "./story-card";
import type { StoryDetail } from "@/lib/stories";
import type { StoryChapter } from "@/lib/types";
import { ENDINGS, GENRES, TAGS, THEMES } from "@/lib/constants";
import { api, ApiClientError } from "@/lib/offline/client";
import { cn, compact, timeAgo, uid } from "@/lib/utils";

type Viewer = { id: string; displayName: string; maxIntensity: number };
type Op = "continue" | "rewrite" | "expand" | "shorten" | "branch" | "regenerate";
const OPS: { op: Op; label: string; hint: string }[] = [
  { op: "continue", label: "Continue", hint: "Write what happens next, after this passage" },
  { op: "rewrite", label: "Rewrite", hint: "Fresh phrasing, same meaning" },
  { op: "expand", label: "Expand", hint: "More detail and interiority" },
  { op: "shorten", label: "Shorten", hint: "Tighten to about half" },
  { op: "regenerate", label: "Regenerate", hint: "Same beat, new execution" },
  { op: "branch", label: "Branch", hint: "Start a new story that diverges here" },
];

export function StoryReader({ initial, viewer }: { initial: StoryDetail; viewer: Viewer }) {
  const router = useRouter();
  const toast = useToast();
  const [story, setStory] = React.useState(initial);
  const [chapter, setChapter] = React.useState(() => Math.min(initial.bookmark?.chapterIndex ?? 0, Math.max(0, initial.chapters.length - 1)));
  const [editing, setEditing] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [editingText, setEditingText] = React.useState<{ id: string; text: string } | null>(null);
  const [opBusy, setOpBusy] = React.useState<Op | "save" | "delete" | null>(null);
  const [opSheet, setOpSheet] = React.useState<Op | null>(null);
  const [instructions, setInstructions] = React.useState("");
  const [chaptersOpen, setChaptersOpen] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const restored = React.useRef(false);
  const isOwner = story.isOwner;
  const chapters = story.chapters;
  const current = chapters[Math.min(chapter, chapters.length - 1)];
  const published = story.status === "PUBLISHED" && story.visibility === "PUBLIC";

  /* ---------- bookmark: restore once, then save on scroll (debounced) ---------- */
  React.useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const ratio = initial.bookmark?.scrollRatio ?? 0;
    if (ratio > 0.02) {
      requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo({ top: max * ratio, behavior: "instant" as ScrollBehavior });
      });
    }
  }, [initial.bookmark]);

  React.useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    let last = "";
    const onScroll = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const ratio = Math.min(1, Math.max(0, window.scrollY / max));
        const key = `${chapter}:${ratio.toFixed(2)}`;
        if (key === last) return;
        last = key;
        void api(`/api/stories/${story.id}/bookmark`, { method: "PUT", json: { chapterIndex: chapter, scrollRatio: Number(ratio.toFixed(3)) } }).catch(() => {});
      }, 900);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (t) clearTimeout(t);
    };
  }, [chapter, story.id]);

  function fail(err: unknown, fallback: string) {
    toast.push(err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : fallback, "error");
  }
  function goChapter(i: number) {
    setChapter(Math.max(0, Math.min(chapters.length - 1, i)));
    setSelected(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- owner: content edits ---------- */
  async function saveChapters(next: StoryChapter[], msg = "Saved") {
    setOpBusy("save");
    try {
      const d = await api<StoryDetail>(`/api/stories/${story.id}/content`, { method: "PUT", json: { chapters: next } });
      setStory(d);
      toast.push(msg, "success");
      return true;
    } catch (err) {
      fail(err, "Could not save");
      return false;
    } finally {
      setOpBusy(null);
    }
  }
  async function savePassageText() {
    if (!editingText) return;
    const next = chapters.map((c) => ({ ...c, passages: c.passages.map((p) => (p.id === editingText.id ? { ...p, text: editingText.text } : p)) }));
    if (await saveChapters(next)) setEditingText(null);
  }
  async function deletePassage(id: string) {
    const next = chapters.map((c) => ({ ...c, passages: c.passages.filter((p) => p.id !== id) }));
    if (await saveChapters(next, "Passage removed")) setSelected(null);
  }
  async function addPassageAfter(id: string) {
    const next = chapters.map((c) => {
      const i = c.passages.findIndex((p) => p.id === id);
      if (i < 0) return c;
      const passages = [...c.passages];
      passages.splice(i + 1, 0, { id: uid("p"), text: "New passage." });
      return { ...c, passages };
    });
    await saveChapters(next, "Passage added");
  }
  async function runOp(op: Op) {
    if (!selected) return;
    setOpBusy(op);
    try {
      const res = await api<StoryDetail | { branchId: string }>(`/api/stories/${story.id}/passages/${selected}/op`, { method: "POST", json: { operation: op, instructions: instructions.trim() || undefined } });
      setOpSheet(null);
      setInstructions("");
      if ("branchId" in res) {
        toast.push("Branch created as a new private draft", "success");
        router.push(`/stories/${res.branchId}`);
        return;
      }
      setStory(res);
      toast.push(op === "continue" ? "Continued" : "Passage updated", "success");
    } catch (err) {
      fail(err, "Could not run that");
    } finally {
      setOpBusy(null);
    }
  }
  async function deleteStory() {
    setOpBusy("delete");
    try {
      await api(`/api/stories/${story.id}`, { method: "DELETE" });
      toast.push("Story deleted", "success");
      router.replace("/stories?view=mine");
    } catch (err) {
      fail(err, "Could not delete");
      setOpBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl leading-tight">{story.title}</h1>
            <IntensityBadge level={story.intensity} />
            {isOwner && <StatusPill status={story.status} visibility={story.visibility} modStatus={story.modStatus} />}
          </div>
          <p className="mt-1 text-xs text-muted">
            by <span className="text-fg-2">{story.author.displayName}</span> · {story.genre} · {compact(story.wordCount)} words · {readingMinutes(story.wordCount)} min read · {compact(story.viewCount)} views · {timeAgo(story.publishedAt ?? story.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          {!isOwner && <FollowButton userId={story.author.id} initial={story.isFollowing} />}
          {isOwner && (
            <Button variant={editing ? "primary" : "secondary"} size="sm" onClick={() => { setEditing((e) => !e); setSelected(null); setEditingText(null); }} aria-pressed={editing}>
              {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />} {editing ? "Done" : "Edit"}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setMenuOpen(true)} aria-label="More actions"><MoreHorizontal className="h-5 w-5" /></Button>
        </div>
      </div>
      {isOwner && <ReviewNotice modStatus={story.modStatus} />}
      {isOwner && !published && story.modStatus === "ACTIVE" && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm">
          <span className="flex items-center gap-2 text-fg-2"><Lock className="h-4 w-4 text-accent-2" /> Private draft. Only you can read this.</span>
          <Button size="sm" onClick={() => setPublishOpen(true)}><Globe className="h-3.5 w-3.5" /> Publish</Button>
        </div>
      )}
      {story.parentStoryId && <p className="text-xs text-muted">Branched from <a href={`/stories/${story.parentStoryId}`} className="text-accent-2 underline-offset-2 hover:underline">another story</a>.</p>}

      {/* Chapter strip */}
      {chapters.length > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setChaptersOpen(true)}><List className="h-3.5 w-3.5" /> Chapters</Button>
          <div className="scrollbar-none flex flex-1 gap-1 overflow-x-auto">
            {chapters.map((c, i) => (
              <Chip key={c.id} size="sm" active={i === chapter} onClick={() => goChapter(i)}>{i + 1}. {c.title}</Chip>
            ))}
          </div>
        </div>
      )}

      {/* Editor toolbar */}
      {isOwner && editing && (
        <div className="card space-y-2 p-3">
          <p className="text-xs text-muted">{selected ? "Passage selected. Pick an action:" : "Tap a passage to select it, then continue, rewrite, expand, shorten, branch or edit it."}</p>
          <div className="flex flex-wrap gap-1.5">
            {OPS.map((o) => (
              <Button key={o.op} variant={o.op === "branch" ? "gold" : "secondary"} size="sm" disabled={!selected || opBusy !== null} loading={opBusy === o.op} onClick={() => setOpSheet(o.op)} title={o.hint}>
                {o.op === "branch" ? <GitBranch className="h-3.5 w-3.5" /> : <Wand2 className="h-3.5 w-3.5" />} {o.label}
              </Button>
            ))}
            <Button variant="ghost" size="sm" disabled={!selected || opBusy !== null} onClick={() => { const p = current?.passages.find((x) => x.id === selected); if (p) setEditingText({ id: p.id, text: p.text }); }}><Pencil className="h-3.5 w-3.5" /> Edit text</Button>
            <Button variant="ghost" size="sm" disabled={!selected || opBusy !== null} onClick={() => selected && addPassageAfter(selected)}><Plus className="h-3.5 w-3.5" /> Insert after</Button>
            <Button variant="ghost" size="sm" disabled={!selected || opBusy !== null} onClick={() => selected && deletePassage(selected)}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            <Button variant="ghost" size="sm" onClick={() => setChaptersOpen(true)}><List className="h-3.5 w-3.5" /> Chapters</Button>
            <Button variant="ghost" size="sm" onClick={() => setDetailsOpen(true)}><Pencil className="h-3.5 w-3.5" /> Details</Button>
          </div>
        </div>
      )}

      {/* Reading view */}
      <article className="card p-5 sm:p-8">
        {current ? (
          <>
            {chapters.length > 1 && <p className="mb-1 text-[11px] uppercase tracking-widest text-muted">Chapter {chapter + 1} of {chapters.length}</p>}
            <h2 className="mb-5 text-xl">{current.title}</h2>
            <div className={cn("prose-story text-[15px] text-fg-2 sm:text-base", editing && "select-text")}>
              {current.passages.length === 0 && <p className="text-muted">This chapter is empty.</p>}
              {current.passages.map((p) =>
                editingText?.id === p.id ? (
                  <div key={p.id} className="mb-4 space-y-2">
                    <Textarea value={editingText.text} onChange={(e) => setEditingText({ id: p.id, text: e.target.value })} className="min-h-[140px] text-[15px] leading-relaxed" aria-label="Edit passage" autoFocus />
                    <div className="flex gap-2">
                      <Button size="sm" loading={opBusy === "save"} onClick={savePassageText}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingText(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : editing ? (
                  <p key={p.id} role="button" tabIndex={0} aria-pressed={selected === p.id} onClick={() => setSelected(selected === p.id ? null : p.id)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelected(selected === p.id ? null : p.id)} className={cn("-mx-2 cursor-pointer rounded-lg px-2 transition focus-ring", selected === p.id ? "bg-accent-soft ring-1 ring-accent/50" : "hover:bg-surface-2")}>
                    {p.text}
                  </p>
                ) : (
                  <p key={p.id}>{p.text}</p>
                ),
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">This story has no chapters yet.</p>
        )}
        {chapters.length > 1 && (
          <div className="mt-8 flex items-center justify-between border-t border-line pt-4">
            <Button variant="ghost" size="sm" disabled={chapter === 0} onClick={() => goChapter(chapter - 1)}><ChevronLeft className="h-4 w-4" /> Previous</Button>
            <span className="text-xs text-muted">{chapter + 1} / {chapters.length}</span>
            <Button variant="ghost" size="sm" disabled={chapter >= chapters.length - 1} onClick={() => goChapter(chapter + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
          </div>
        )}
      </article>

      {/* Viewer actions */}
      <div className="flex flex-wrap items-center gap-2">
        <ReactionBar type="story" id={story.id} initial={story.reaction as ReactionKind | null} counts={story.reactions} />
        <ContentFavoriteButton type="story" id={story.id} initial={story.isFavorite} count={story.favoriteCount} />
        <AddToCollectionButton targetType="STORY" targetId={story.id} />
        <ShareButton path={`/stories/${story.id}`} enabled={published} />
        {!isOwner && <ReportButton targetType="STORY" targetId={story.id} />}
      </div>
      {story.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {story.tags.map((t) => (
            <span key={t} className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] text-fg-2">#{t}</span>
          ))}
        </div>
      )}
      <CharacterLinks characters={story.characters} context={{ version: 1, origin: "story", hook: story.summary }} />

      {/* Op sheet */}
      <Sheet open={opSheet !== null} onClose={() => setOpSheet(null)} title={OPS.find((o) => o.op === opSheet)?.label}>
        {opSheet && (
          <div className="space-y-4">
            <p className="text-sm text-fg-2">{OPS.find((o) => o.op === opSheet)?.hint}.{opSheet === "branch" && " The original stays untouched; the branch becomes a new private draft."}</p>
            <Field label="Author notes (optional)"><Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={500} placeholder="Make it slower, keep the rain, end on her line…" className="min-h-[80px]" /></Field>
            <Button className="w-full" loading={opBusy === opSheet} onClick={() => runOp(opSheet)}>{OPS.find((o) => o.op === opSheet)?.label}</Button>
          </div>
        )}
      </Sheet>

      {/* Chapters sheet */}
      {chaptersOpen && <ChaptersSheet open onClose={() => setChaptersOpen(false)} chapters={chapters} current={chapter} editable={isOwner && editing} onGo={(i) => { goChapter(i); setChaptersOpen(false); }} onSave={(next) => saveChapters(next, "Chapters updated")} />}

      {detailsOpen && <DetailsEditor story={story} maxIntensity={viewer.maxIntensity} onClose={() => setDetailsOpen(false)} onSaved={(d) => { setStory(d); setDetailsOpen(false); }} />}

      <PublishDialog<StoryDetail> open={publishOpen} onClose={() => setPublishOpen(false)} kind="story" id={story.id} title={story.title} displayName={viewer.displayName} published={published} onDone={setStory} />

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Story">
        <div className="space-y-1.5">
          <a href={`/api/stories/${story.id}/export?format=md`} download className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-fg hover:bg-surface-2 focus-ring"><Download className="h-4 w-4 text-muted" /> Download as Markdown</a>
          <a href={`/api/stories/${story.id}/export?format=json`} download className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-fg hover:bg-surface-2 focus-ring"><Download className="h-4 w-4 text-muted" /> Download as JSON</a>
          {isOwner && (
            <>
              <button onClick={() => { setMenuOpen(false); setPublishOpen(true); }} disabled={story.modStatus !== "ACTIVE"} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-fg hover:bg-surface-2 focus-ring disabled:opacity-50">
                {published ? <Lock className="h-4 w-4 text-muted" /> : <Globe className="h-4 w-4 text-muted" />} {published ? "Keep private (unpublish)" : "Publish"}
              </button>
              <button onClick={() => { setMenuOpen(false); setDetailsOpen(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-fg hover:bg-surface-2 focus-ring"><Pencil className="h-4 w-4 text-muted" /> Edit title, summary & tags</button>
              <button onClick={() => { setMenuOpen(false); setDeleteOpen(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-danger hover:bg-danger/10 focus-ring"><Trash2 className="h-4 w-4" /> Delete story</button>
            </>
          )}
        </div>
      </Sheet>

      <Sheet open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete this story?">
        <p className="text-sm text-fg-2">This permanently deletes the story. Branches made from it are kept. This can&apos;t be undone.</p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="danger" className="flex-1" loading={opBusy === "delete"} onClick={deleteStory}>Delete</Button>
        </div>
      </Sheet>
    </div>
  );
}

function ChaptersSheet({ open, onClose, chapters, current, editable, onGo, onSave }: { open: boolean; onClose: () => void; chapters: StoryChapter[]; current: number; editable: boolean; onGo: (i: number) => void; onSave: (next: StoryChapter[]) => Promise<boolean> }) {
  const [draft, setDraft] = React.useState(chapters);
  const [saving, setSaving] = React.useState(false);
  const [prevChapters, setPrevChapters] = React.useState(chapters);
  if (chapters !== prevChapters) {
    setPrevChapters(chapters);
    setDraft(chapters);
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(chapters);
  function move(i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= draft.length) return;
    const next = [...draft];
    [next[i], next[j]] = [next[j], next[i]];
    setDraft(next);
  }
  return (
    <Sheet open={open} onClose={onClose} title="Chapters">
      <ol className="space-y-1.5">
        {draft.map((c, i) => (
          <li key={c.id} className="flex items-center gap-2">
            {editable ? (
              <>
                <Input value={c.title} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} maxLength={120} aria-label={`Chapter ${i + 1} title`} />
                <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === draft.length - 1} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => draft.length > 1 && setDraft(draft.filter((_, j) => j !== i))} disabled={draft.length <= 1} aria-label="Delete chapter"><Trash2 className="h-4 w-4" /></Button>
              </>
            ) : (
              <button onClick={() => onGo(i)} className={cn("flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm focus-ring", i === current ? "bg-accent-soft text-accent-2" : "text-fg hover:bg-surface-2")}>
                <span>{i + 1}. {c.title}</span>
                <span className="text-[11px] text-muted">{c.passages.length} passages</span>
              </button>
            )}
          </li>
        ))}
      </ol>
      {editable && (
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setDraft([...draft, { id: uid("ch"), title: `Chapter ${draft.length + 1}`, passages: [{ id: uid("p"), text: "…" }] }])}><Plus className="h-3.5 w-3.5" /> Add chapter</Button>
          <Button size="sm" className="ml-auto" disabled={!dirty} loading={saving} onClick={async () => { setSaving(true); if (await onSave(draft)) onClose(); setSaving(false); }}>Save changes</Button>
        </div>
      )}
    </Sheet>
  );
}

function DetailsEditor({ story, maxIntensity, onClose, onSaved }: { story: StoryDetail; maxIntensity: number; onClose: () => void; onSaved: (d: StoryDetail) => void }) {
  const toast = useToast();
  const [title, setTitle] = React.useState(story.title);
  const [summary, setSummary] = React.useState(story.summary);
  const [genre, setGenre] = React.useState(story.genre);
  const [endingType, setEndingType] = React.useState(story.endingType);
  const [tags, setTags] = React.useState(story.tags);
  const [intensity, setIntensity] = React.useState(story.intensity);
  const [saving, setSaving] = React.useState(false);
  async function save() {
    setSaving(true);
    try {
      const d = await api<StoryDetail>(`/api/stories/${story.id}`, { method: "PUT", json: { title, summary, genre, endingType, tags, intensity } });
      toast.push("Draft saved", "success");
      onSaved(d);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Sheet open onClose={onClose} title="Story details">
      <div className="space-y-4">
        <Field label="Title" required><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></Field>
        <Field label="Summary" hint="Shown on cards and used as the hook when readers start a chat."><Textarea value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={300} className="min-h-[72px]" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Genre"><Select value={genre} onChange={(e) => setGenre(e.target.value)}>{GENRES.map((g) => <option key={g} value={g}>{g}</option>)}</Select></Field>
          <Field label="Ending"><Select value={endingType} onChange={(e) => setEndingType(e.target.value)}>{ENDINGS.map((e) => <option key={e} value={e}>{e}</option>)}</Select></Field>
        </div>
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
