"use client";
import Link from "next/link";
import { Heart, Layers } from "lucide-react";
import { BlurGuard, IntensityBadge } from "@/components/ui";
import { ContentFavoriteButton } from "@/components/content/content-favorite-button";
import { StatusPill } from "@/components/content/status";
import type { ComicCard as Card } from "@/lib/comics";
import { cn, compact } from "@/lib/utils";

export function aspectFor(orientation: string) {
  return orientation === "landscape" ? "aspect-[4/3]" : orientation === "square" ? "aspect-square" : "aspect-[3/4]";
}

export function ComicCard({ c, blur = false }: { c: Card; blur?: boolean }) {
  return (
    <Link href={`/comics/${c.id}`} className="card card-hover group block overflow-hidden focus-ring">
      <div className={cn("relative w-full overflow-hidden bg-surface-2", aspectFor(c.orientation))}>
        <BlurGuard enabled={blur && c.intensity >= 2 && !c.isOwner} className="h-full w-full">
          {c.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted"><Layers className="h-8 w-8" /></div>
          )}
        </BlurGuard>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        <div className="absolute left-2 top-2 flex gap-1">
          <IntensityBadge level={c.intensity} />
          {c.isOwner && (c.status !== "PUBLISHED" || c.modStatus !== "ACTIVE") && <StatusPill status={c.status} visibility={c.visibility} modStatus={c.modStatus} className="h-5 text-[10px]" />}
        </div>
        <div className="absolute right-2 top-2">
          <ContentFavoriteButton type="comic" id={c.id} initial={c.isFavorite} count={c.favoriteCount} overlay label={false} />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="truncate text-base leading-tight text-white">{c.title}</h3>
          <p className="line-clamp-2 text-xs text-white/75">{c.premise}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 p-3 text-[11px] text-muted">
        <span className="truncate">by {c.author.displayName}</span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-0.5" title="Pages"><Layers className="h-3 w-3" />{c.pageCount}</span>
          <span className="inline-flex items-center gap-0.5" title="Reactions"><Heart className="h-3 w-3" />{compact(c.likeCount)}</span>
        </span>
      </div>
    </Link>
  );
}

export function ComicCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton aspect-[3/4] w-full !rounded-none" />
      <div className="flex justify-between p-3">
        <div className="skeleton h-3 w-1/2" />
        <div className="skeleton h-3 w-1/5" />
      </div>
    </div>
  );
}
