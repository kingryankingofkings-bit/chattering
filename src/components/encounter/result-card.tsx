"use client";
import * as React from "react";
import Link from "next/link";
import { Bookmark, Dices, MapPin, Play, Sparkles } from "lucide-react";
import { FavoriteButton } from "@/components/character/character-card";
import { BlockCreatorButton } from "@/components/character/creator-actions";
import { ReportButton } from "@/components/character/report-button";
import { Avatar, BlurGuard, Button, Chip, IntensityBadge, Skeleton } from "@/components/ui";
import type { RollResult } from "@/lib/encounter";
import { Typewriter } from "./typewriter";

export function ResultCard({ result, blur, rerolling, starting, onReroll, onSave, onStartChat, onBlocked, loadedFrom }: { result: RollResult; blur: boolean; rerolling: boolean; starting: boolean; onReroll: () => void; onSave: () => void; onStartChat: () => void; onBlocked: () => void; loadedFrom?: string | null }) {
  const c = result.character;
  return (
    <article className="card overflow-hidden fade-up" aria-label={`Encounter with ${c.name}`}>
      <div className="flex gap-4 p-4">
        <Link href={`/character/${c.id}`} className="shrink-0 focus-ring rounded-2xl" aria-label={`Open ${c.name}'s profile`}>
          <BlurGuard enabled={blur && c.intensity >= 2} className="rounded-2xl">
            <Avatar name={c.name} seed={c.avatarSeed} src={c.avatarUrl} size={96} />
          </BlurGuard>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted">{loadedFrom ? `Saved · ${loadedFrom}` : "You've matched with"}</p>
              <h2 className="truncate text-2xl leading-tight">
                <Link href={`/character/${c.id}`} className="hover:underline focus-ring">{c.name}</Link>
              </h2>
            </div>
            <FavoriteButton characterId={c.id} initial={!!c.isFavorite} count={c.favoriteCount} />
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-fg-2">{c.tagline}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <IntensityBadge level={c.intensity} />
            <span className="text-[11px] text-muted">
              by <Link href={`/creator/${c.creator.id}`} className="hover:underline focus-ring">{c.creator.displayName}</Link>
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4 border-t border-line bg-surface-2/40 p-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-gold" aria-hidden />
            <h3 className="font-display text-lg text-gold">{result.scenario.title}</h3>
            <IntensityBadge level={result.scenario.intensity} className="ml-auto" />
          </div>
          <p className="flex items-start gap-1.5 text-sm text-fg-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
            <span>{result.scenario.setting}</span>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-fg">{result.scenario.hook}</p>
          {(result.scenario.themes.length > 0 || result.scenario.tags.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1">
              {result.scenario.themes.map((t) => (
                <Chip key={`th-${t}`} size="sm" tone="gold">{t}</Chip>
              ))}
              {result.scenario.tags.map((t) => (
                <Chip key={`tg-${t}`} size="sm">{t}</Chip>
              ))}
            </div>
          )}
        </div>
        <blockquote className="rounded-xl border-l-2 border-accent bg-surface px-4 py-3 text-sm italic leading-relaxed text-fg">
          <Typewriter key={`${c.id}:${result.openingMessage.slice(0, 24)}`} text={result.openingMessage} />
        </blockquote>
        {result.hardLimits && <p className="text-[11px] text-muted">Hard limits applied: {result.hardLimits}</p>}
      </div>

      <div className="space-y-2 p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Button size="lg" className="col-span-2 sm:col-span-1" loading={starting} onClick={onStartChat}>
            <Play className="h-4 w-4" fill="currentColor" /> Start chat
          </Button>
          <Button size="lg" variant="secondary" loading={rerolling} onClick={onReroll}>
            <Dices className="h-4 w-4" /> Reroll
          </Button>
          <Button size="lg" variant="gold" onClick={onSave}>
            <Bookmark className="h-4 w-4" /> Save
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <ReportButton targetType="CHARACTER" targetId={c.id} />
          <BlockCreatorButton creatorId={c.creator.id} creatorName={c.creator.displayName} afterBlock={onBlocked} />
        </div>
      </div>
    </article>
  );
}

export function ResultSkeleton() {
  return (
    <div className="card overflow-hidden" aria-busy="true" aria-label="Finding your match">
      <div className="flex gap-4 p-4">
        <Skeleton className="h-24 w-24 !rounded-2xl" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
      <div className="space-y-3 border-t border-line p-4">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
        <Skeleton className="col-span-2 h-12 sm:col-span-1" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    </div>
  );
}
