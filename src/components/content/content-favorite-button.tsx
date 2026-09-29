"use client";
import * as React from "react";
import { Bookmark } from "lucide-react";
import { useToast } from "@/components/ui";
import { api } from "@/lib/offline/client";
import { cn, compact } from "@/lib/utils";

export function ContentFavoriteButton({ type, id, initial, count, className, label = true, overlay = false }: { type: "comic" | "story" | "image"; id: string; initial: boolean; count?: number; className?: string; label?: boolean; overlay?: boolean }) {
  const [fav, setFav] = React.useState(initial);
  const [n, setN] = React.useState(count ?? 0);
  const [prevInitial, setPrevInitial] = React.useState(initial);
  const toast = useToast();
  if (initial !== prevInitial) {
    // Sync from props during render (the React-recommended alternative to a setState effect).
    setPrevInitial(initial);
    setFav(initial);
  }
  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !fav;
    setFav(next);
    setN((x) => Math.max(0, x + (next ? 1 : -1)));
    try {
      await api(`/api/content/${type}/${id}/favorite`, { method: next ? "POST" : "DELETE" });
    } catch (err) {
      setFav(!next);
      setN((x) => Math.max(0, x + (next ? -1 : 1)));
      toast.push(err instanceof Error ? err.message : "Could not update favorite", "error");
    }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={fav}
      aria-label={fav ? "Remove from favorites" : "Add to favorites"}
      className={cn(
        "inline-flex items-center gap-1 rounded-full text-xs font-medium transition focus-ring",
        overlay ? "px-2 py-1" : "h-8 border px-2.5",
        fav ? (overlay ? "bg-accent text-white" : "border-accent bg-accent text-white") : overlay ? "bg-black/45 text-white/90 hover:bg-black/65" : "border-line bg-surface-2 text-fg-2 hover:border-line-2 hover:text-fg",
        className,
      )}
    >
      <Bookmark className="h-3.5 w-3.5" fill={fav ? "currentColor" : "none"} />
      {count !== undefined && <span>{compact(n)}</span>}
      {label && !overlay && <span className="sr-only sm:not-sr-only">{fav ? "Saved" : "Save"}</span>}
    </button>
  );
}
