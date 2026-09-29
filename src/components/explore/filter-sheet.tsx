"use client";
import * as React from "react";
import { Button, Chip, Segmented, Sheet } from "@/components/ui";
import { GENDER_PRESENTATIONS, INTENSITY_LABELS, ORIENTATIONS, PERSONALITIES, ROLE_TYPES, TAGS, THEMES } from "@/lib/constants";
import { activeFilterCount, type ExploreFilters, type Facet } from "./filters";

const GROUPS: { facet: Facet; label: string; options: readonly string[] }[] = [
  { facet: "themes", label: "Themes", options: THEMES },
  { facet: "tags", label: "Tags", options: TAGS },
  { facet: "gender", label: "Gender presentation", options: GENDER_PRESENTATIONS },
  { facet: "orientation", label: "Orientation", options: ORIENTATIONS },
  { facet: "personality", label: "Personality", options: PERSONALITIES },
  { facet: "role", label: "Role", options: ROLE_TYPES },
];

/** Bottom sheet of chip filters. Edits a local draft; `Apply` commits it to the URL. */
export function FilterSheet({ open, onClose, value, maxIntensity, onApply }: { open: boolean; onClose: () => void; value: ExploreFilters; maxIntensity: number; onApply: (next: ExploreFilters) => void }) {
  const [draft, setDraft] = React.useState<ExploreFilters>(value);
  const [prevOpen, setPrevOpen] = React.useState(open);
  // Re-seed the draft from the committed filters each time the sheet opens.
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setDraft(value);
  }

  const toggle = (facet: Facet, opt: string) =>
    setDraft((d) => ({ ...d, [facet]: d[facet].includes(opt) ? d[facet].filter((x) => x !== opt) : [...d[facet], opt] }));
  const intensityOptions = [1, 2, 3].filter((n) => n <= maxIntensity).map((n) => ({ value: String(n), label: `≤ ${INTENSITY_LABELS[n]}` }));
  const currentIntensity = String(draft.intensity ?? maxIntensity);
  const count = activeFilterCount(draft, maxIntensity);

  return (
    <Sheet open={open} onClose={onClose} title="Filters" wide>
      <div className="space-y-5">
        {intensityOptions.length > 1 && (
          <section aria-labelledby="f-intensity">
            <h3 id="f-intensity" className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Content intensity</h3>
            <Segmented value={currentIntensity} onChange={(v) => setDraft((d) => ({ ...d, intensity: Number(v) >= maxIntensity ? null : Number(v) }))} options={intensityOptions} />
            <p className="mt-1.5 text-xs text-muted">Your account cap is {INTENSITY_LABELS[maxIntensity]}. Change it in settings.</p>
          </section>
        )}
        {GROUPS.map((g) => (
          <section key={g.facet} aria-labelledby={`f-${g.facet}`}>
            <h3 id={`f-${g.facet}`} className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
              {g.label}
              {draft[g.facet].length > 0 && <span className="ml-2 text-accent-2">{draft[g.facet].length}</span>}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {g.options.map((opt) => (
                <Chip key={opt} active={draft[g.facet].includes(opt)} onClick={() => toggle(g.facet, opt)}>
                  {opt}
                </Chip>
              ))}
            </div>
          </section>
        ))}
        <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-line bg-surface/95 px-5 pt-3 backdrop-blur">
          <Button variant="ghost" onClick={() => setDraft((d) => ({ ...d, tags: [], themes: [], gender: [], orientation: [], personality: [], role: [], intensity: null }))} disabled={count === 0}>
            Clear all
          </Button>
          <Button className="flex-1" onClick={() => { onApply(draft); onClose(); }}>
            Show results{count > 0 ? ` (${count} filter${count === 1 ? "" : "s"})` : ""}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
