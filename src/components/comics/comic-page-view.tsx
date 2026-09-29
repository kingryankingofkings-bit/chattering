"use client";
import * as React from "react";
import { ImageOff, Pencil } from "lucide-react";
import type { ComicPage, ComicPanel } from "@/lib/types";
import { cn } from "@/lib/utils";

export function layoutClass(layout: string, orientation: string) {
  switch (layout) {
    case "grid-6":
      return "grid-cols-2 grid-rows-3";
    case "strip-3":
      return orientation === "landscape" ? "grid-cols-1 grid-rows-3" : "grid-cols-3 grid-rows-1";
    case "splash":
      return "grid-cols-1 grid-rows-1";
    case "grid-4":
    default:
      return "grid-cols-2 grid-rows-2";
  }
}

export function panelAspect(orientation: string) {
  return orientation === "landscape" ? "aspect-[4/3]" : orientation === "square" ? "aspect-square" : "aspect-[3/4]";
}

/** One page of the comic as a CSS grid of panels with caption / speech bubbles / SFX overlays. */
export function ComicPageView({ page, layout, orientation, editable, onEditPanel, className, busyPanelId }: { page: ComicPage; layout: string; orientation: string; editable?: boolean; onEditPanel?: (panel: ComicPanel) => void; className?: string; busyPanelId?: string | null }) {
  return (
    <div className={cn("grid gap-1.5 rounded-xl bg-black p-1.5", layoutClass(layout, orientation), className)} aria-label="Comic page">
      {page.panels.map((panel, i) => (
        <PanelView key={panel.id} panel={panel} index={i} orientation={orientation} editable={editable} onEdit={onEditPanel} busy={busyPanelId === panel.id} splash={layout === "splash"} />
      ))}
    </div>
  );
}

function PanelView({ panel, index, orientation, editable, onEdit, busy, splash }: { panel: ComicPanel; index: number; orientation: string; editable?: boolean; onEdit?: (p: ComicPanel) => void; busy?: boolean; splash?: boolean }) {
  const Wrapper = editable ? "button" : "div";
  return (
    <Wrapper
      type={editable ? "button" : undefined}
      onClick={editable && onEdit ? () => onEdit(panel) : undefined}
      aria-label={editable ? `Edit panel ${index + 1}` : undefined}
      className={cn("group relative overflow-hidden rounded-md border border-white/15 bg-surface-2 text-left", !splash && panelAspect(orientation), splash && "min-h-[60vh]", editable && "cursor-pointer focus-ring hover:border-accent")}
    >
      {panel.mediaId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/media/${panel.mediaId}`} alt={panel.imagePrompt ? `Panel ${index + 1}: ${panel.imagePrompt.slice(0, 120)}` : `Panel ${index + 1}`} className={cn("absolute inset-0 h-full w-full object-cover transition", busy && "opacity-40 blur-sm")} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted"><ImageOff className="h-6 w-6" /></div>
      )}
      {busy && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-black/70 px-3 py-1 text-xs text-white">Redrawing…</span>
        </div>
      )}
      {panel.caption && (
        <div className="absolute left-1.5 top-1.5 max-w-[85%] rounded-sm border border-black/60 bg-[#f7efd9] px-2 py-1 font-display text-[11px] italic leading-snug text-black shadow sm:text-xs">{panel.caption}</div>
      )}
      {panel.sfx.length > 0 && (
        <div className="pointer-events-none absolute right-2 top-1/3 flex flex-col items-end gap-1">
          {panel.sfx.map((s, i) => (
            <span key={i} className="font-display text-xl font-black uppercase tracking-wider text-[#ffe36e] drop-shadow-[0_2px_0_rgba(0,0,0,.9)] sm:text-2xl" style={{ transform: `rotate(${i % 2 ? 6 : -8}deg)` }}>{s}</span>
          ))}
        </div>
      )}
      {panel.dialogue.length > 0 && (
        <div className="absolute inset-x-1.5 bottom-1.5 flex flex-col gap-1">
          {panel.dialogue.map((d, i) => (
            <div key={i} className={cn("max-w-[88%] rounded-2xl bg-white px-2.5 py-1.5 text-[11px] leading-snug text-black shadow-[0_2px_0_rgba(0,0,0,.8)] sm:text-xs", i % 2 ? "self-end rounded-br-sm" : "self-start rounded-bl-sm")}>
              {d.speaker && <span className="mr-1 font-semibold uppercase tracking-wide text-[10px] text-accent">{d.speaker}:</span>}
              {d.text}
            </div>
          ))}
        </div>
      )}
      {editable && (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-white opacity-80 transition group-hover:opacity-100" aria-hidden><Pencil className="h-3 w-3" /></span>
      )}
    </Wrapper>
  );
}
