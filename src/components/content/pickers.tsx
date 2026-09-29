"use client";
import * as React from "react";
import { Check, X } from "lucide-react";
import { Avatar, Chip, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

export type PickableCharacterItem = { id: string; name: string; avatarUrl: string | null; avatarSeed: string; intensity: number; tagline: string };

/** Multi (or single) select over the characters a user can feature. */
export function CharacterPicker({ characters, value, onChange, max = 4, single = false }: { characters: PickableCharacterItem[]; value: string[]; onChange: (ids: string[]) => void; max?: number; single?: boolean }) {
  const [q, setQ] = React.useState("");
  const list = q ? characters.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())) : characters;
  function toggle(id: string) {
    if (single) return onChange(value.includes(id) ? [] : [id]);
    if (value.includes(id)) return onChange(value.filter((x) => x !== id));
    if (value.length >= max) return;
    onChange([...value, id]);
  }
  if (characters.length === 0) return <p className="rounded-xl border border-dashed border-line p-3 text-sm text-muted">No characters yet. Favorite or chat with a character first, or create your own.</p>;
  return (
    <div className="space-y-2">
      {characters.length > 6 && <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search characters" aria-label="Search characters" />}
      <ul className="grid max-h-64 grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2" role="listbox" aria-multiselectable={!single}>
        {list.map((c) => {
          const on = value.includes(c.id);
          return (
            <li key={c.id}>
              <button type="button" role="option" aria-selected={on} onClick={() => toggle(c.id)} className={cn("flex w-full items-center gap-2 rounded-xl border p-2 text-left transition focus-ring", on ? "border-accent bg-accent-soft" : "border-line bg-surface-2 hover:border-line-2")}>
                <Avatar name={c.name} seed={c.avatarSeed} src={c.avatarUrl} size={34} rounded="rounded-lg" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-fg">{c.name}</span>
                  <span className="block truncate text-[11px] text-muted">{c.tagline}</span>
                </span>
                {on && <Check className="h-4 w-4 shrink-0 text-accent-2" />}
              </button>
            </li>
          );
        })}
        {list.length === 0 && <li className="p-2 text-sm text-muted">No matches.</li>}
      </ul>
    </div>
  );
}

/** Intensity chips, capped by the viewer's preference. */
export function IntensityPicker({ value, onChange, max = 3 }: { value: number; onChange: (v: number) => void; max?: number }) {
  const opts = [
    { v: 1, label: "Suggestive" },
    { v: 2, label: "Explicit" },
    { v: 3, label: "Intense" },
  ];
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Intensity">
      {opts.map((o) => {
        const locked = o.v > max;
        return (
          <Chip key={o.v} active={value === o.v} onClick={locked ? undefined : () => onChange(o.v)} className={cn(locked && "opacity-40")}>
            {o.label}
            {locked && <span className="sr-only"> (above your max intensity)</span>}
          </Chip>
        );
      })}
    </div>
  );
}

/** Minimal tag editor: chips + input (Enter/comma adds). */
export function TagInput({ value, onChange, suggestions = [], max = 10, placeholder = "Add a tag" }: { value: string[]; onChange: (tags: string[]) => void; suggestions?: readonly string[]; max?: number; placeholder?: string }) {
  const [draft, setDraft] = React.useState("");
  function add(t: string) {
    const tag = t.trim().toLowerCase().replace(/[^a-z0-9 \-]/g, "").slice(0, 30);
    if (!tag || value.includes(tag) || value.length >= max) return;
    onChange([...value, tag]);
    setDraft("");
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((t) => (
          <span key={t} className="inline-flex h-7 items-center gap-1 rounded-full border border-accent/40 bg-accent-soft pl-2.5 pr-1 text-xs text-accent-2">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove tag ${t}`} className="rounded-full p-0.5 hover:bg-accent/30 focus-ring">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {value.length < max && (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                add(draft);
              } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
            }}
            onBlur={() => draft && add(draft)}
            placeholder={placeholder}
            aria-label="Add tag"
            className="h-7 min-w-[8rem] flex-1 rounded-full border border-dashed border-line bg-transparent px-2.5 text-xs text-fg placeholder:text-muted focus:border-accent/60 focus:outline-none"
          />
        )}
      </div>
      {suggestions.length > 0 && value.length < max && (
        <div className="scrollbar-none flex gap-1 overflow-x-auto">
          {suggestions.filter((s) => !value.includes(s)).slice(0, 14).map((s) => (
            <Chip key={s} size="sm" onClick={() => add(s)}>+ {s}</Chip>
          ))}
        </div>
      )}
    </div>
  );
}

/** Tiny stepper used by generation flows. */
export function ProgressSteps({ steps, active, failed }: { steps: string[]; active: number; failed?: boolean }) {
  return (
    <ol className="flex flex-col gap-2" aria-live="polite">
      {steps.map((s, i) => {
        const state = i < active ? "done" : i === active ? (failed ? "failed" : "active") : "todo";
        return (
          <li key={s} className="flex items-center gap-3 text-sm">
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px]", state === "done" && "border-success/50 bg-success/15 text-success", state === "active" && "border-accent bg-accent-soft text-accent-2", state === "failed" && "border-danger/50 bg-danger/15 text-danger", state === "todo" && "border-line text-muted")}>
              {state === "done" ? <Check className="h-3.5 w-3.5" /> : state === "active" ? <span className="h-2 w-2 animate-pulse rounded-full bg-accent-2" /> : i + 1}
            </span>
            <span className={cn(state === "todo" ? "text-muted" : "text-fg")}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}
