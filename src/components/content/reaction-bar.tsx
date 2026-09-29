"use client";
import * as React from "react";
import { Flame, Heart, Sparkles, ThumbsUp } from "lucide-react";
import { useToast } from "@/components/ui";
import { api } from "@/lib/offline/client";
import { cn, compact } from "@/lib/utils";

export type ReactionKind = "like" | "fire" | "heart" | "wow";
const KINDS: { kind: ReactionKind; label: string; icon: React.ComponentType<{ className?: string; fill?: string }> }[] = [
  { kind: "like", label: "Like", icon: ThumbsUp },
  { kind: "fire", label: "Fire", icon: Flame },
  { kind: "heart", label: "Love", icon: Heart },
  { kind: "wow", label: "Wow", icon: Sparkles },
];

/**
 * One reaction per viewer; tapping the active kind removes it. `counts` is the
 * per-kind breakdown from the detail endpoint; the total is the item's likeCount.
 */
export function ReactionBar({ type, id, initial, counts, className, compactMode = false }: { type: "comic" | "story" | "image"; id: string; initial: ReactionKind | null; counts: Record<string, number>; className?: string; compactMode?: boolean }) {
  const [active, setActive] = React.useState<ReactionKind | null>(initial);
  const [tally, setTally] = React.useState<Record<string, number>>(counts);
  const [busy, setBusy] = React.useState(false);
  const toast = useToast();

  async function choose(kind: ReactionKind) {
    if (busy) return;
    const prevActive = active;
    const prevTally = tally;
    const next = active === kind ? null : kind;
    setActive(next);
    setTally((t) => {
      const c = { ...t };
      if (prevActive) c[prevActive] = Math.max(0, (c[prevActive] ?? 0) - 1);
      if (next) c[next] = (c[next] ?? 0) + 1;
      return c;
    });
    setBusy(true);
    try {
      const res = await api<{ reactions: Record<string, number> }>(`/api/content/${type}/${id}/react`, next ? { method: "POST", json: { kind: next } } : { method: "DELETE" });
      setTally(res.reactions);
    } catch (err) {
      setActive(prevActive);
      setTally(prevTally);
      toast.push(err instanceof Error ? err.message : "Could not react", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("flex items-center gap-1", className)} role="group" aria-label="Reactions">
      {KINDS.map(({ kind, label, icon: Icon }) => {
        const on = active === kind;
        const n = tally[kind] ?? 0;
        return (
          <button key={kind} type="button" onClick={() => choose(kind)} aria-pressed={on} aria-label={`${label}${n ? ` (${n})` : ""}`} className={cn("inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition focus-ring", on ? "border-accent bg-accent text-white" : "border-line bg-surface-2 text-fg-2 hover:border-line-2 hover:text-fg")}>
            <Icon className="h-3.5 w-3.5" fill={on ? "currentColor" : "none"} />
            {!compactMode && n > 0 && <span>{compact(n)}</span>}
          </button>
        );
      })}
    </div>
  );
}
