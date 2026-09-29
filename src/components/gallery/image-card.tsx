"use client";
import Link from "next/link";
import { Heart } from "lucide-react";
import { BlurGuard, IntensityBadge } from "@/components/ui";
import { ContentFavoriteButton } from "@/components/content/content-favorite-button";
import { StatusPill } from "@/components/content/status";
import type { ImageCard as Card } from "@/lib/images";
import { compact } from "@/lib/utils";

export function ImageCard({ c, blur = false }: { c: Card; blur?: boolean }) {
  const ratio = c.width && c.height ? c.width / c.height : c.orientation === "landscape" ? 4 / 3 : c.orientation === "square" ? 1 : 3 / 4;
  return (
    <Link href={`/gallery/${c.id}`} className="card card-hover group relative block overflow-hidden focus-ring" aria-label={c.title || "Untitled image"}>
      <div className="relative w-full bg-surface-2" style={{ aspectRatio: String(ratio) }}>
        <BlurGuard enabled={blur && c.intensity >= 2 && !c.isOwner} className="h-full w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.url} alt={c.title || ""} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        </BlurGuard>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute left-2 top-2 flex gap-1">
          <IntensityBadge level={c.intensity} />
          {c.isOwner && (c.status !== "PUBLISHED" || c.modStatus !== "ACTIVE") && <StatusPill status={c.status} visibility={c.visibility} modStatus={c.modStatus} className="h-5 text-[10px]" />}
        </div>
        <div className="absolute right-2 top-2">
          <ContentFavoriteButton type="image" id={c.id} initial={c.isFavorite} overlay label={false} />
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2.5">
          <div className="min-w-0">
            {c.title && <p className="truncate text-sm text-white">{c.title}</p>}
            <p className="truncate text-[11px] text-white/70">{c.owner.displayName}{c.character ? ` · ${c.character.name}` : ""}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-white/80"><Heart className="h-3 w-3" />{compact(c.likeCount)}</span>
        </div>
      </div>
    </Link>
  );
}

export function ImageCardSkeleton({ i = 0 }: { i?: number }) {
  const ratios = ["3/4", "1/1", "4/3", "3/4", "1/1"];
  return <div className="skeleton w-full" style={{ aspectRatio: ratios[i % ratios.length] }} />;
}
