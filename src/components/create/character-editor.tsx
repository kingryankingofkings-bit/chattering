"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Globe, Link2, Lock, MessageCircle, MoreHorizontal, Save } from "lucide-react";
import { Button, Chip, Field, IntensityBadge, Select, useToast } from "@/components/ui";
import { DYNAMICS, MESSAGE_LENGTHS, RESPONSE_STYLES, TAGS, THEMES } from "@/lib/constants";
import { CHARACTER_SELECTS, FIELD_SECTION, emptyCharacterInput, type CharacterFull, type CharacterInput } from "@/lib/character-schema";
import type { EngagementStats } from "@/lib/types";
import { api, ApiClientError } from "@/lib/offline/client";
import { cn } from "@/lib/utils";
import { AvatarPicker } from "./avatar-picker";
import { ActionsSheet, DeleteCharacterSheet, useCharacterActions } from "./character-actions";
import { Checkbox, ChipPicker, ListEditor, LoreEditor, Section, TextField } from "./editor-fields";
import { StatsBar } from "./stats-bar";

type SectionId = "basics" | "personality" | "scenario" | "lore" | "content" | "visibility";
type FieldError = { field: string; message: string } | null;

function stripMeta(c: CharacterFull): CharacterInput {
  const { id: _i, avatarUrl: _a, status: _s, createdAt: _c, updatedAt: _u, ...input } = c;
  void _i; void _a; void _s; void _c; void _u;
  return input;
}

const VIS = [
  { value: "PRIVATE", label: "Private", icon: Lock, blurb: "Only you. Perfect while you're still building." },
  { value: "UNLISTED", label: "Unlisted", icon: Link2, blurb: "Anyone with the link can chat. Not listed in Explore." },
  { value: "PUBLIC", label: "Public", icon: Globe, blurb: "Listed in Explore for everyone to discover." },
] as const;

export function CharacterEditor({ initial, initialStats }: { initial: CharacterFull | null; initialStats: EngagementStats | null }) {
  const router = useRouter();
  const toast = useToast();
  const actions = useCharacterActions();
  const [id, setId] = React.useState<string | null>(initial?.id ?? null);
  const [status] = React.useState(initial?.status ?? "ACTIVE");
  const [input, setInput] = React.useState<CharacterInput>(() => (initial ? stripMeta(initial) : emptyCharacterInput()));
  const [savedJson, setSavedJson] = React.useState(() => JSON.stringify(initial ? stripMeta(initial) : null));
  const [stats, setStats] = React.useState<EngagementStats | null>(initialStats);
  const [open, setOpen] = React.useState<Record<SectionId, boolean>>({ basics: true, personality: !!initial, scenario: false, lore: false, content: false, visibility: false });
  const [fieldError, setFieldError] = React.useState<FieldError>(null);
  const [saving, setSaving] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const dirty = JSON.stringify(input) !== savedJson;
  const dirtyRef = React.useRef(dirty);
  React.useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  // Unsaved-changes guard: browser navigation + in-app link clicks.
  React.useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") ?? "";
      if (!href.startsWith("/") || href === window.location.pathname) return;
      if (!window.confirm("You have unsaved changes. Leave without saving?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  const set = <K extends keyof CharacterInput>(key: K, value: CharacterInput[K]) => {
    setInput((s) => ({ ...s, [key]: value }));
    if (fieldError?.field === key) setFieldError(null);
  };
  const setSheet = <K extends keyof CharacterInput["sheet"]>(key: K, value: CharacterInput["sheet"][K]) => {
    setInput((s) => ({ ...s, sheet: { ...s.sheet, [key]: value } }));
    if (fieldError?.field === key) setFieldError(null);
  };
  const err = (field: string) => (fieldError?.field === field ? fieldError.message : undefined);
  const toggle = (s: SectionId) => setOpen((o) => ({ ...o, [s]: !o[s] }));

  function showError(e: unknown) {
    if (e instanceof ApiClientError) {
      const body = e.body as { field?: string; issues?: { path: string; message: string }[] } | null;
      const field = body?.field ?? body?.issues?.[0]?.path?.split(".").pop();
      const message = body?.issues?.[0]?.message ?? e.message;
      if (field) {
        setFieldError({ field, message });
        const section = (FIELD_SECTION[field] ?? "basics") as SectionId;
        setOpen((o) => ({ ...o, [section]: true }));
        requestAnimationFrame(() => document.getElementById(`section-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
      toast.push(message, "error");
    } else toast.push(e instanceof Error ? e.message : "Could not save", "error");
  }

  /** Saves and returns the character id, or null when validation failed. */
  async function save(): Promise<string | null> {
    if (!input.name.trim()) {
      setFieldError({ field: "name", message: "Give your character a name" });
      setOpen((o) => ({ ...o, basics: true }));
      return null;
    }
    setSaving(true);
    try {
      const res = id
        ? await api<{ character: CharacterFull; stats: EngagementStats }>(`/api/characters/${id}`, { method: "PUT", json: input })
        : await api<{ id: string; character: CharacterFull; stats: EngagementStats }>("/api/characters", { method: "POST", json: input });
      const saved = stripMeta(res.character);
      setInput(saved);
      setSavedJson(JSON.stringify(saved));
      setStats(res.stats);
      setFieldError(null);
      toast.push(id ? "Saved" : "Character created", "success");
      if (!id) {
        setId(res.character.id);
        window.history.replaceState(null, "", `/create/${res.character.id}`);
      }
      router.refresh();
      return res.character.id;
    } catch (e) {
      showError(e);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function testChat() {
    let cid = id;
    if (!cid || dirty) cid = await save();
    if (cid) await actions.testChat(cid);
  }

  const complete = {
    basics: !!input.name && !!input.tagline && input.ageConfirmed && input.fictionConfirmed,
    personality: !!input.sheet.personality,
    scenario: !!input.sheet.scenario || !!input.sheet.openingMessage,
    lore: input.sheet.lorebook.length > 0 || input.sheet.memories.length > 0,
    content: input.tags.length > 0 || input.themes.length > 0,
    visibility: input.visibility !== "PRIVATE",
  };
  const errSection = fieldError ? (FIELD_SECTION[fieldError.field] as SectionId | undefined) : undefined;
  const Vis = VIS.find((v) => v.value === input.visibility)!;

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="space-y-3">
        <Link href="/create" className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg focus-ring rounded">
          <ArrowLeft className="h-3.5 w-3.5" /> Your characters
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl">{input.name || (id ? "Untitled" : "New character")}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1"><Vis.icon className="h-3 w-3" /> {Vis.label}</span>
              <IntensityBadge level={input.intensity} />
              {status !== "ACTIVE" && <span className="inline-flex items-center gap-1 rounded-md border border-danger/30 bg-danger/15 px-1.5 text-[10px] font-semibold uppercase text-danger"><EyeOff className="h-3 w-3" /> {status === "HIDDEN" ? "Hidden by moderation" : "Removed"}</span>}
            </div>
          </div>
          {id && (
            <Button variant="secondary" size="icon" aria-label="More actions" onClick={() => setMenuOpen(true)}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          )}
        </div>
        {stats && <StatsBar stats={stats} />}
      </div>

      {/* Basics */}
      <Section id="basics" title="Basics" subtitle="Name, age, look" open={open.basics} onToggle={() => toggle("basics")} complete={complete.basics} hasError={errSection === "basics"}>
        <AvatarPicker name={input.name} seed={input.avatarSeed} mediaId={input.avatarMediaId} appearance={input.appearance} onChange={(m) => set("avatarMediaId", m)} onShuffle={() => set("avatarSeed", Math.random().toString(36).slice(2, 10))} />
        <TextField label="Name" required value={input.name} onChange={(v) => set("name", v)} error={err("name")} maxLength={60} placeholder="Vesper Kane" />
        <TextField label="Tagline" value={input.tagline} onChange={(v) => set("tagline", v)} error={err("tagline")} maxLength={160} placeholder="The bartender who already knows your order" hint="One line shown on the card." />
        <TextField label="Description" multiline value={input.description} onChange={(v) => set("description", v)} error={err("description")} maxLength={2000} placeholder="Who they are in a paragraph — public on the profile." />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stated age" required error={err("statedAge")} hint="18 or older, always.">
            <input type="number" min={18} max={9999} value={input.statedAge} onChange={(e) => set("statedAge", Number(e.target.value) || 0)} className={cn("w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-fg focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/25", err("statedAge") && "border-danger/60")} aria-invalid={!!err("statedAge")} />
          </Field>
          <TextField label="Pronouns" value={input.pronouns} onChange={(v) => set("pronouns", v)} error={err("pronouns")} maxLength={40} placeholder="she/her" />
        </div>
        <Checkbox checked={input.ageConfirmed} onChange={(v) => set("ageConfirmed", v)} label="This character is 18+" description="Required to publish. Adult characters only, no exceptions." error={err("ageConfirmed")} />
        <Checkbox checked={input.fictionConfirmed} onChange={(v) => set("fictionConfirmed", v)} label="This character is fictional and not based on a real person" description="No celebrities, no people you know, no likenesses." error={err("fictionConfirmed")} />
        <TextField label="Identity" value={input.identity} onChange={(v) => set("identity", v)} error={err("identity")} maxLength={200} placeholder="Human, vampire, android…" />
        <TextField label="Appearance" multiline value={input.appearance} onChange={(v) => set("appearance", v)} error={err("appearance")} maxLength={2000} placeholder="Hair, eyes, build, style. Also seeds the generated avatar." />
      </Section>

      {/* Personality */}
      <Section id="personality" title="Personality" subtitle="How they think, talk and want" open={open.personality} onToggle={() => toggle("personality")} complete={complete.personality} hasError={errSection === "personality"}>
        <TextField label="Personality" multiline value={input.sheet.personality} onChange={(v) => setSheet("personality", v)} error={err("personality")} maxLength={2000} placeholder="Warm, wry, perceptive. Teases to test, then softens once she trusts you." />
        <TextField label="Behavior" multiline value={input.sheet.behavior} onChange={(v) => setSheet("behavior", v)} error={err("behavior")} maxLength={2000} placeholder="Habits, tells, what they do with their hands." />
        <TextField label="Speaking style" multiline value={input.sheet.speakingStyle} onChange={(v) => setSheet("speakingStyle", v)} error={err("speakingStyle")} maxLength={1000} placeholder="Low, unhurried, dry humor. Calls you 'trouble'." rows={2} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Likes" multiline value={input.sheet.likes} onChange={(v) => setSheet("likes", v)} error={err("likes")} maxLength={1000} rows={2} />
          <TextField label="Dislikes" multiline value={input.sheet.dislikes} onChange={(v) => setSheet("dislikes", v)} error={err("dislikes")} maxLength={1000} rows={2} />
        </div>
        <TextField label="Boundaries" multiline value={input.sheet.boundaries} onChange={(v) => setSheet("boundaries", v)} error={err("boundaries")} maxLength={1000} rows={2} hint="Lines the character never crosses. Consent is always implied." />
        <TextField label="Backstory" multiline value={input.sheet.backstory} onChange={(v) => setSheet("backstory", v)} error={err("backstory")} maxLength={4000} rows={4} />
        <TextField label="Relationship style" multiline value={input.sheet.relationshipStyle} onChange={(v) => setSheet("relationshipStyle", v)} error={err("relationshipStyle")} maxLength={1000} rows={2} placeholder="Slow burn that sparks fast once it catches." />
        <TextField label="Goals" multiline value={input.sheet.goals} onChange={(v) => setSheet("goals", v)} error={err("goals")} maxLength={1000} rows={2} placeholder="What they want from you, and from life." />
      </Section>

      {/* Scenario */}
      <Section id="scenario" title="Scenario" subtitle="Where the story starts" open={open.scenario} onToggle={() => toggle("scenario")} complete={complete.scenario} hasError={errSection === "scenario"}>
        <TextField label="Scenario" multiline value={input.sheet.scenario} onChange={(v) => setSheet("scenario", v)} error={err("scenario")} maxLength={2000} placeholder="It's 1 a.m., the bar is nearly empty, and you're the last customer she hasn't figured out yet." />
        <TextField label="Setting" multiline value={input.sheet.setting} onChange={(v) => setSheet("setting", v)} error={err("setting")} maxLength={2000} rows={2} placeholder="A basement speakeasy with velvet booths and one flickering neon sign." />
        <TextField label="Opening message" multiline value={input.sheet.openingMessage} onChange={(v) => setSheet("openingMessage", v)} error={err("openingMessage")} maxLength={2000} rows={4} placeholder={"*She slides a coaster in front of you.* \"Talk, or let me guess.\""} hint="Their first line in every new chat. Use *asterisks* for actions." />
        <TextField label="Example dialogue" multiline value={input.sheet.exampleDialogue} onChange={(v) => setSheet("exampleDialogue", v)} error={err("exampleDialogue")} maxLength={4000} rows={5} placeholder={"User: What do you recommend?\nVesper: \"Depends. Are we celebrating or forgetting?\""} hint="Private. Teaches the model their voice." />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Response style">
            <Select value={input.responseStyle} onChange={(e) => set("responseStyle", e.target.value as CharacterInput["responseStyle"])}>
              {RESPONSE_STYLES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label="Message length">
            <Select value={input.messageLength} onChange={(e) => set("messageLength", e.target.value as CharacterInput["messageLength"])}>
              {MESSAGE_LENGTHS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Section>

      {/* Lore */}
      <Section id="lore" title="Lore & memories" subtitle="Private world facts" open={open.lore} onToggle={() => toggle("lore")} complete={complete.lore} hasError={errSection === "lore"}>
        <LoreEditor value={input.sheet.lorebook} onChange={(v) => setSheet("lorebook", v)} error={err("lorebook")} />
        <ListEditor label="Memories" value={input.sheet.memories} onChange={(v) => setSheet("memories", v)} error={err("memories")} placeholder="Something they always remember about you or their past" hint="Private. Injected into every chat as 'important memories'." maxLength={500} multiline />
      </Section>

      {/* Content */}
      <Section id="content" title="Content & discovery" subtitle="Tags, themes, intensity, dynamics" open={open.content} onToggle={() => toggle("content")} complete={complete.content} hasError={errSection === "content"}>
        <ChipPicker label="Themes" options={THEMES} value={input.themes} onChange={(v) => set("themes", v)} max={15} error={err("themes")} />
        <ChipPicker label="Tags" options={TAGS} value={input.tags} onChange={(v) => set("tags", v)} allowCustom max={20} error={err("tags")} hint="Custom tags are welcome. Keep them honest so filters work for everyone." />
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(CHARACTER_SELECTS) as (keyof typeof CHARACTER_SELECTS)[]).map((k) => (
            <Field key={k} label={k === "genderPresentation" ? "Gender presentation" : k === "personalityType" ? "Personality type" : k === "roleType" ? "Role" : "Orientation"} error={err(k)}>
              <Select value={input[k]} onChange={(e) => set(k, e.target.value)}>
                <option value="">—</option>
                {CHARACTER_SELECTS[k].map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </Select>
            </Field>
          ))}
        </div>
        <div className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">Intensity</span>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Intensity">
            {[1, 2, 3].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={input.intensity === n} onClick={() => set("intensity", n)} className={cn("flex flex-col items-center gap-1 rounded-xl border p-3 text-xs transition focus-ring", input.intensity === n ? "border-accent/50 bg-accent-soft" : "border-line bg-surface-2 hover:border-line-2")}>
                <IntensityBadge level={n} />
                <span className="text-muted">{n === 1 ? "Flirty & suggestive" : n === 2 ? "Explicit scenes" : "Intense & unfiltered"}</span>
              </button>
            ))}
          </div>
        </div>
        <ChipPicker label="Allowed dynamics" options={DYNAMICS} value={input.allowedDynamics} onChange={(v) => set("allowedDynamics", v)} max={20} error={err("allowedDynamics")} />
        <ListEditor label="Prohibited topics" value={input.prohibitedTopics} onChange={(v) => set("prohibitedTopics", v)} error={err("prohibitedTopics")} placeholder="e.g. humiliation, degradation, gore" hint="Things this character refuses to go near, on top of the platform rules. Use general words." maxLength={80} max={30} />
      </Section>

      {/* Visibility */}
      <Section id="visibility" title="Visibility" subtitle={Vis.label} open={open.visibility} onToggle={() => toggle("visibility")} complete={complete.visibility} hasError={errSection === "visibility"}>
        <div className="space-y-2" role="radiogroup" aria-label="Visibility">
          {VIS.map((v) => (
            <button key={v.value} type="button" role="radio" aria-checked={input.visibility === v.value} onClick={() => set("visibility", v.value)} className={cn("flex w-full items-start gap-3 rounded-xl border p-3 text-left transition focus-ring", input.visibility === v.value ? "border-accent/50 bg-accent-soft" : "border-line bg-surface-2 hover:border-line-2")}>
              <v.icon className="mt-0.5 h-4 w-4 shrink-0 text-accent-2" aria-hidden />
              <span>
                <span className="block text-sm text-fg">{v.label}</span>
                <span className="block text-xs text-muted">{v.blurb}</span>
              </span>
            </button>
          ))}
        </div>
        {input.visibility !== "PRIVATE" && (
          <div className="rounded-xl border border-line bg-surface-2 p-3 text-xs">
            <p className="mb-2 flex items-center gap-1.5 font-medium text-fg"><Eye className="h-3.5 w-3.5 text-accent-2" /> What becomes visible to others</p>
            <div className="flex flex-wrap gap-1.5">
              {["name", "tagline", "description", "appearance", "avatar", "tags & themes", "scenario & setting", "opening message", "personality summary"].map((t) => (
                <Chip key={t} size="sm" tone="accent">{t}</Chip>
              ))}
            </div>
            <p className="mb-2 mt-3 flex items-center gap-1.5 font-medium text-fg"><Lock className="h-3.5 w-3.5 text-gold" /> Always private</p>
            <div className="flex flex-wrap gap-1.5">
              {["lorebook", "memories", "example dialogue", "your chats"].map((t) => (
                <Chip key={t} size="sm" tone="gold">{t}</Chip>
              ))}
            </div>
            {!(input.ageConfirmed && input.fictionConfirmed) && <p className="mt-3 text-danger">Confirm the 18+ and fiction checkboxes in Basics before publishing.</p>}
          </div>
        )}
      </Section>

      {/* Sticky action bar */}
      <div className="glass fixed inset-x-0 bottom-[calc(4rem+var(--safe-bottom))] z-30 border-t border-line">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2.5">
          <span className={cn("min-w-0 flex-1 truncate text-xs", dirty ? "text-warning" : "text-muted")} aria-live="polite">{saving ? "Saving…" : dirty ? "Unsaved changes" : id ? "All changes saved" : "Not saved yet"}</span>
          <Button variant="secondary" size="sm" onClick={testChat} loading={actions.busy === "test"} disabled={saving}>
            <MessageCircle className="h-3.5 w-3.5" /> Test chat
          </Button>
          <Button size="sm" onClick={save} loading={saving} disabled={!dirty && !!id}>
            <Save className="h-3.5 w-3.5" /> {id ? "Save" : "Create"}
          </Button>
        </div>
      </div>

      {id && (
        <>
          <ActionsSheet open={menuOpen} onClose={() => setMenuOpen(false)} busy={actions.busy} onDuplicate={() => actions.duplicate(id)} onExport={() => actions.exportJson(id)} onDelete={() => { setMenuOpen(false); setConfirmDelete(true); }} />
          <DeleteCharacterSheet open={confirmDelete} name={input.name} onClose={() => setConfirmDelete(false)} loading={actions.busy === "delete"} onConfirm={async () => { setSavedJson(JSON.stringify(input)); if (await actions.remove(id)) { router.replace("/create"); router.refresh(); } else setConfirmDelete(false); }} />
        </>
      )}
    </div>
  );
}
