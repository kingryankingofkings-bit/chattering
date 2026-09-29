"use client";
import * as React from "react";
import Link from "next/link";
import { Heart, MessageCircle, Star } from "lucide-react";
import { Avatar, BlurGuard, Chip, IntensityBadge, useToast } from "@/components/ui";
import type { CharacterCard as Card } from "@/lib/characters";
import { api } from "@/lib/offline/client";
import { cn, compact } from "@/lib/utils";

export function FavoriteButton({ characterId, initial, count, onChange, className }: { characterId: string; initial: boolean; count?: number; onChange?: (fav: boolean) => void; className?: string }) {
  const [fav, setFav] = React.useState(initial);
  const [n, setN] = React.useState(count ?? 0);
  const [prevInitial, setPrevInitial] = React.useState(initial);
  const toast = useToast();
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setFav(initial);
  }
  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !fav;
    setFav(next);
    setN((x) => Math.max(0, x + (next ? 1 : -1)));
    onChange?.(next);
    try {
      await api(`/api/characters/${characterId}/favorite`, { method: next ? "POST" : "DELETE" });
    } catch (err) {
      setFav(!next);
      setN((x) => Math.max(0, x + (next ? -1 : 1)));
      toast.push(err instanceof Error ? err.message : "Could not update favorite", "error");
    }
  }
  return (
    <button onClick={toggle} aria-pressed={fav} aria-label={fav ? "Remove from favorites" : "Add to favorites"} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs transition focus-ring", fav ? "bg-accent text-white" : "bg-black/40 text-white/90 hover:bg-black/60", className)}>
      <Heart className="h-3.5 w-3.5" fill={fav ? "currentColor" : "none"} />
      {count !== undefined && <span>{compact(n)}</span>}
    </button>
  );
}

export function CharacterCard({ c, blur = false, compactMode = false }: { c: Card; blur?: boolean; compactMode?: boolean }) {
  return (
    <Link href={`/character/${c.id}`} className="card card-hover group block overflow-hidden focus-ring">
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface-2">
        <BlurGuard enabled={blur && c.intensity >= 2} className="h-full w-full">
          <Avatar name={c.name} seed={c.avatarSeed} src={c.avatarUrl} size={400} rounded="rounded-none" className="!h-full !w-full" />
        </BlurGuard>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        <div className="absolute left-2 top-2 flex gap-1">
          <IntensityBadge level={c.intensity} />
        </div>
        <div className="absolute right-2 top-2">
          <FavoriteButton characterId={c.id} initial={!!c.isFavorite} count={c.favoriteCount} />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="truncate text-base leading-tight text-white">{c.name}</h3>
          <p className="line-clamp-2 text-xs text-white/75">{c.tagline}</p>
        </div>
      </div>
      {!compactMode && (
        <div className="space-y-2 p-3">
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span className="truncate">by {c.creator.displayName}</span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="inline-flex items-center gap-0.5"><MessageCircle className="h-3 w-3" />{compact(c.chatCount)}</span>
              {c.rating !== null && <span className="inline-flex items-center gap-0.5 text-gold"><Star className="h-3 w-3" fill="currentColor" />{c.rating.toFixed(1)}</span>}
            </span>
          </div>
          <div className="scrollbar-none flex gap-1 overflow-x-auto">
            {c.tags.slice(0, 3).map((t) => (
              <Chip key={t} size="sm">{t}</Chip>
            ))}
          </div>
        </div>
      )}
    </Link>
  );
}

export function CharacterCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton aspect-[3/4] w-full !rounded-none" />
      <div className="space-y-2 p-3">
        <div className="skeleton h-3 w-2/3" />
        <div className="skeleton h-3 w-1/2" />
      </div>
    </div>
  );
}
