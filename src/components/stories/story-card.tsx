"use client";
import Link from "next/link";
import { BookOpen, Heart } from "lucide-react";
import { Chip, IntensityBadge } from "@/components/ui";
import { ContentFavoriteButton } from "@/components/content/content-favorite-button";
import { StatusPill } from "@/components/content/status";
import type { StoryCard as Card } from "@/lib/stories";
import { compact } from "@/lib/utils";

const LENGTH_LABEL: Record<string, string> = { flash: "Flash", short: "Short", medium: "Medium", long: "Long" };

export function readingMinutes(words: number) {
  return Math.max(1, Math.round(words / 220));
}

export function StoryCard({ c }: { c: Card }) {
  return (
    <Link href={`/stories/${c.id}`} className="card card-hover block p-4 focus-ring">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip size="sm" tone="accent">{c.genre}</Chip>
            <IntensityBadge level={c.intensity} />
            {c.isOwner && (c.status !== "PUBLISHED" || c.modStatus !== "ACTIVE") && <StatusPill status={c.status} visibility={c.visibility} modStatus={c.modStatus} className="h-5 text-[10px]" />}
          </div>
          <h3 className="mt-2 text-lg leading-tight text-fg">{c.title}</h3>
          <p className="mt-1 line-clamp-3 text-sm text-fg-2">{c.summary || "No summary yet."}</p>
        </div>
        <ContentFavoriteButton type="story" id={c.id} initial={c.isFavorite} label={false} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted">
        <span className="truncate">by {c.author.displayName}</span>
        <span className="flex shrink-0 items-center gap-2">
          <span>{LENGTH_LABEL[c.length] ?? c.length} · {compact(c.wordCount)} words · {readingMinutes(c.wordCount)} min</span>
          <span className="inline-flex items-center gap-0.5"><Heart className="h-3 w-3" />{compact(c.likeCount)}</span>
        </span>
      </div>
      {c.tags.length > 0 && (
        <div className="scrollbar-none mt-2 flex gap-1 overflow-x-auto">
          {c.tags.slice(0, 5).map((t) => (
            <Chip key={t} size="sm">{t}</Chip>
          ))}
        </div>
      )}
    </Link>
  );
}

export function StoryCardSkeleton() {
  return (
    <div className="card space-y-3 p-4">
      <div className="skeleton h-4 w-24" />
      <div className="skeleton h-5 w-2/3" />
      <div className="skeleton h-3 w-full" />
      <div className="skeleton h-3 w-5/6" />
      <div className="flex justify-between"><div className="skeleton h-3 w-1/4" /><div className="skeleton h-3 w-1/3" /></div>
    </div>
  );
}

export function StoryIcon() {
  return <BookOpen className="h-8 w-8" />;
}
