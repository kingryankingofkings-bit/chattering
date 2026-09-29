"use client";
import * as React from "react";
import { SearchX, WifiOff } from "lucide-react";
import { CharacterCard, CharacterCardSkeleton } from "@/components/character/character-card";
import { FeedSentinel } from "@/components/feed/feed-sentinel";
import { useInfiniteFeed } from "@/components/feed/use-infinite-feed";
import { EmptyState, ErrorState } from "@/components/ui";
import type { CharacterCard as Card } from "@/lib/characters";

/** Cursor-paginated 2/3-column grid of character cards driven by `GET /api/characters?...`. */
export function CharacterGrid({ url, blur, emptyTitle = "Nobody here yet", emptyDescription = "Try a different search or loosen your filters.", emptyAction, onCount }: { url: string; blur: boolean; emptyTitle?: string; emptyDescription?: string; emptyAction?: React.ReactNode; onCount?: (n: number) => void }) {
  const feed = useInfiniteFeed<Card>(url);
  const { items, loading, loadingMore, error, offline, done, loadMore, refresh } = feed;
  React.useEffect(() => onCount?.(items.length), [items.length, onCount]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-busy="true" aria-label="Loading characters">
        {Array.from({ length: 6 }).map((_, i) => (
          <CharacterCardSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (error && items.length === 0) return <ErrorState title="Couldn't load characters" description={error} onRetry={() => void refresh()} />;
  if (items.length === 0) return <EmptyState icon={<SearchX className="h-8 w-8" />} title={emptyTitle} description={emptyDescription} action={emptyAction} />;

  return (
    <div className="space-y-3">
      {offline && (
        <p className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning" role="status">
          <WifiOff className="h-3.5 w-3.5" /> You&apos;re offline — showing what we saved last time.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((c) => (
          <CharacterCard key={c.id} c={c} blur={blur} />
        ))}
      </div>
      {error && <ErrorState title="Couldn't load more" description={error} onRetry={loadMore} />}
      <FeedSentinel onVisible={loadMore} loading={loadingMore} done={done} />
    </div>
  );
}
