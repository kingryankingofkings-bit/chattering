"use client";
import * as React from "react";
import { Check, ChevronDown, Plus, Trash2, X } from "lucide-react";
import { Button, Chip, Field, Input, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";

/* ---------- Collapsible section card ---------- */
export function Section({ id, title, subtitle, open, onToggle, complete, hasError, children }: { id: string; title: string; subtitle?: string; open: boolean; onToggle: () => void; complete?: boolean; hasError?: boolean; children: React.ReactNode }) {
  return (
    <section id={`section-${id}`} className={cn("card overflow-hidden transition-colors", hasError && "border-danger/50")}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`panel-${id}`} className="flex w-full items-center gap-3 px-4 py-3.5 text-left focus-ring">
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs", complete ? "border-success/40 bg-success/15 text-success" : hasError ? "border-danger/40 bg-danger/15 text-danger" : "border-line bg-surface-2 text-muted")} aria-hidden>
          {complete ? <Check className="h-3.5 w-3.5" /> : hasError ? "!" : ""}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base leading-tight">{title}</span>
          {subtitle && <span className="block truncate text-xs text-muted">{subtitle}</span>}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div id={`panel-${id}`} className="fade-up space-y-4 border-t border-line px-4 pb-5 pt-4">
          {children}
        </div>
      )}
    </section>
  );
}

/* ---------- Text field bound to a string ---------- */
export function TextField({ label, value, onChange, error, hint, multiline, placeholder, maxLength, rows, required, type = "text" }: { label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string; multiline?: boolean; placeholder?: string; maxLength?: number; rows?: number; required?: boolean; type?: string }) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {multiline ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} rows={rows} aria-invalid={!!error} className={cn(error && "border-danger/60")} />
      ) : (
        <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} aria-invalid={!!error} className={cn(error && "border-danger/60")} />
      )}
    </Field>
  );
}

/* ---------- Checkbox ---------- */
export function Checkbox({ checked, onChange, label, description, error }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; error?: string }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition", checked ? "border-accent/40 bg-accent-soft/60" : "border-line bg-surface-2", error && "border-danger/60")}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]" aria-invalid={!!error} />
      <span>
        <span className="block text-sm text-fg">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
        {error && <span className="block text-xs text-danger">{error}</span>}
      </span>
    </label>
  );
}

/* ---------- Chip picker with optional custom entries ---------- */
export function ChipPicker({ label, options, value, onChange, allowCustom, max, hint, error }: { label: string; options: readonly string[]; value: string[]; onChange: (v: string[]) => void; allowCustom?: boolean; max?: number; hint?: string; error?: string }) {
  const [custom, setCustom] = React.useState("");
  const toggle = (t: string) => {
    if (value.includes(t)) onChange(value.filter((x) => x !== t));
    else if (!max || value.length < max) onChange([...value, t]);
  };
  const addCustom = () => {
    const t = custom.trim().toLowerCase();
    if (!t || value.includes(t) || (max && value.length >= max)) return;
    onChange([...value, t]);
    setCustom("");
  };
  const extras = value.filter((v) => !options.includes(v));
  return (
    <div className="space-y-2">
      <span className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
        {max && <span className="ml-1 normal-case tracking-normal">({value.length}/{max})</span>}
      </span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map((o) => (
          <Chip key={o} active={value.includes(o)} onClick={() => toggle(o)}>{o}</Chip>
        ))}
        {extras.map((o) => (
          <Chip key={o} active onClick={() => toggle(o)}>
            {o} <X className="h-3 w-3" aria-hidden />
          </Chip>
        ))}
      </div>
      {allowCustom && (
        <div className="flex gap-2">
          <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add your own…" maxLength={32} aria-label={`Custom ${label.toLowerCase()}`} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
          <Button type="button" variant="secondary" onClick={addCustom} aria-label="Add">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
      {hint && !error && <span className="block text-xs text-muted">{hint}</span>}
      {error && <span className="block text-xs text-danger">{error}</span>}
    </div>
  );
}

/* ---------- Simple string list ---------- */
export function ListEditor({ label, value, onChange, placeholder, hint, error, max = 60, maxLength = 500, multiline }: { label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string; hint?: string; error?: string; max?: number; maxLength?: number; multiline?: boolean }) {
  const [draft, setDraft] = React.useState("");
  const add = () => {
    const t = draft.trim();
    if (!t || value.length >= max) return;
    onChange([...value, t]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      <span className="text-xs font-medium uppercase tracking-wider text-muted">{label} <span className="normal-case tracking-normal">({value.length})</span></span>
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((item, i) => (
            <li key={`${i}-${item}`} className="flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{item}</span>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="shrink-0 rounded-md p-1 text-muted hover:text-danger focus-ring" aria-label={`Remove "${item.slice(0, 30)}"`}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        {multiline ? (
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} maxLength={maxLength} rows={2} className="min-h-[60px]" aria-label={`New ${label.toLowerCase()} entry`} />
        ) : (
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} maxLength={maxLength} aria-label={`New ${label.toLowerCase()} entry`} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        )}
        <Button type="button" variant="secondary" onClick={add} disabled={!draft.trim()} aria-label="Add">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {hint && !error && <span className="block text-xs text-muted">{hint}</span>}
      {error && <span className="block text-xs text-danger">{error}</span>}
    </div>
  );
}

/* ---------- Lorebook key/content editor ---------- */
export function LoreEditor({ value, onChange, error }: { value: { key: string; content: string }[]; onChange: (v: { key: string; content: string }[]) => void; error?: string }) {
  const [key, setKey] = React.useState("");
  const [content, setContent] = React.useState("");
  const add = () => {
    if (!key.trim() || !content.trim() || value.length >= 60) return;
    onChange([...value, { key: key.trim(), content: content.trim() }]);
    setKey("");
    setContent("");
  };
  return (
    <div className="space-y-2">
      <span className="text-xs font-medium uppercase tracking-wider text-muted">Lorebook <span className="normal-case tracking-normal">({value.length})</span></span>
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((l, i) => (
            <li key={`${i}-${l.key}`} className="flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-fg">{l.key}</span>
                <span className="block whitespace-pre-wrap break-words text-xs text-fg-2">{l.content}</span>
              </span>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="shrink-0 rounded-md p-1 text-muted hover:text-danger focus-ring" aria-label={`Remove lore entry ${l.key}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-2 rounded-xl border border-dashed border-line p-3">
        <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Key — e.g. The Moth & Lantern" maxLength={80} aria-label="Lore key" />
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="What the character knows about it…" maxLength={2000} rows={2} className="min-h-[64px]" aria-label="Lore content" />
        <Button type="button" variant="secondary" size="sm" onClick={add} disabled={!key.trim() || !content.trim()}>
          <Plus className="h-3.5 w-3.5" /> Add entry
        </Button>
      </div>
      <span className="block text-xs text-muted">Lore stays private. It&apos;s woven into the character&apos;s prompt so they remember your world.</span>
      {error && <span className="block text-xs text-danger">{error}</span>}
    </div>
  );
}
