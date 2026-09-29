"use client";
import * as React from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { Chip, Field, Segmented, Textarea } from "@/components/ui";
import { GENDER_PRESENTATIONS, INTENSITY_LABELS, TAGS, THEMES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type TriState = "in" | "out";
export type EncounterPrefs = {
  themes: Record<string, TriState>;
  tags: Record<string, TriState>;
  gender: string[];
  intensity: number;
  hardLimits: string;
};

export function defaultEncounterPrefs(user: { maxIntensity: number; hardLimits: string; excludedThemes: string[]; preferredThemes?: string[] }): EncounterPrefs {
  const themes: Record<string, TriState> = {};
  for (const t of user.preferredThemes ?? []) themes[t] = "in";
  for (const t of user.excludedThemes) themes[t] = "out";
  return { themes, tags: {}, gender: [], intensity: user.maxIntensity, hardLimits: user.hardLimits };
}

export function splitTri(map: Record<string, TriState>): { include: string[]; exclude: string[] } {
  const include: string[] = [];
  const exclude: string[] = [];
  for (const [k, v] of Object.entries(map)) (v === "in" ? include : exclude).push(k);
  return { include, exclude };
}

export function prefsSummary(p: EncounterPrefs): number {
  return Object.keys(p.themes).length + Object.keys(p.tags).length + p.gender.length;
}

/** Tri-state chip: neutral → include → exclude → neutral. */
function TriChip({ label, state, onChange, locked }: { label: string; state?: TriState; onChange: (s?: TriState) => void; locked?: boolean }) {
  const next = () => onChange(state === undefined ? "in" : state === "in" ? "out" : undefined);
  return (
    <button
      type="button"
      onClick={locked ? undefined : next}
      aria-pressed={state !== undefined}
      aria-label={`${label}: ${state === "in" ? "included" : state === "out" ? "excluded" : "neutral"}${locked ? " (set in your settings)" : ""}`}
      disabled={locked}
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-medium transition focus-ring disabled:cursor-not-allowed",
        state === "in" && "border-accent bg-accent text-white",
        state === "out" && "border-danger/40 bg-danger/15 text-danger line-through decoration-danger/70",
        state === undefined && "border-line bg-surface-2 text-fg-2 hover:border-line-2",
      )}
    >
      {state === "in" && <Plus className="h-3 w-3" aria-hidden />}
      {state === "out" && <Minus className="h-3 w-3" aria-hidden />}
      {label}
    </button>
  );
}

export function PreferencesPanel({ value, onChange, maxIntensity, lockedThemes, open, onToggle }: { value: EncounterPrefs; onChange: (p: EncounterPrefs) => void; maxIntensity: number; lockedThemes: string[]; open: boolean; onToggle: () => void }) {
  const count = prefsSummary(value);
  const setTri = (facet: "themes" | "tags", key: string, s?: TriState) =>
    onChange({ ...value, [facet]: Object.fromEntries(Object.entries({ ...value[facet], [key]: s }).filter(([, v]) => v !== undefined)) as Record<string, TriState> });
  const intensityOptions = [1, 2, 3].filter((n) => n <= maxIntensity).map((n) => ({ value: String(n), label: INTENSITY_LABELS[n] }));

  return (
    <section className="card overflow-hidden">
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls="encounter-prefs" className="flex w-full items-center justify-between px-4 py-3 text-left focus-ring">
        <span>
          <span className="block text-base">Preferences</span>
          <span className="block text-xs text-muted">{count > 0 ? `${count} preference${count === 1 ? "" : "s"} set` : "Tap to tune who you meet"}</span>
        </span>
        <ChevronDown className={cn("h-5 w-5 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div id="encounter-prefs" className="space-y-5 border-t border-line px-4 py-4 fade-up">
          <p className="text-xs text-muted">Tap a chip once to include it, twice to exclude it. Excluded and hidden tags never appear, even on Surprise Me.</p>
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Themes</h3>
            <div className="flex flex-wrap gap-1.5">
              {THEMES.map((t) => (
                <TriChip key={t} label={t} state={value.themes[t]} locked={lockedThemes.includes(t)} onChange={(s) => setTri("themes", t, s)} />
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Tags</h3>
            <div className="flex flex-wrap gap-1.5">
              {TAGS.map((t) => (
                <TriChip key={t} label={t} state={value.tags[t]} onChange={(s) => setTri("tags", t, s)} />
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Gender presentation</h3>
            <div className="flex flex-wrap gap-1.5">
              {GENDER_PRESENTATIONS.map((g) => (
                <Chip key={g} active={value.gender.includes(g)} onClick={() => onChange({ ...value, gender: value.gender.includes(g) ? value.gender.filter((x) => x !== g) : [...value.gender, g] })}>
                  {g}
                </Chip>
              ))}
            </div>
          </div>
          {intensityOptions.length > 1 && (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Intensity (up to)</h3>
              <Segmented value={String(Math.min(value.intensity, maxIntensity))} onChange={(v) => onChange({ ...value, intensity: Number(v) })} options={intensityOptions} />
            </div>
          )}
          <Field label="Hard limits" hint="Anything here is never included in the scene. Pre-filled from your settings.">
            <Textarea value={value.hardLimits} onChange={(e) => onChange({ ...value, hardLimits: e.target.value })} maxLength={600} placeholder="e.g. no humiliation, no public scenes" className="min-h-[72px]" />
          </Field>
        </div>
      )}
    </section>
  );
}
