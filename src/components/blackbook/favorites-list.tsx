"use client";
import * as React from "react";
import { Heart, Search } from "lucide-react";
import { Button, EmptyState, ErrorState, Input, Segmented } from "@/components/ui";
import { CharacterCard, CharacterCardSkeleton } from "@/components/character/character-card";
import { FeedSentinel } from "@/components/feed/feed-sentinel";
import { useInfiniteFeed } from "@/components/feed/use-infinite-feed";
import type { CharacterCard as Card } from "@/lib/characters";
import { AddToCollectionButton } from "./add-to-collection";
import { PinButton } from "./pin-button";
import { useResource } from "./use-resource";

export function FavoritesList({ blur }: { blur: boolean }) {
  const feed = useInfiniteFeed<Card>("/api/me/favorites");
  const pinned = useResource<{ items: Card[] }>("/api/me/pinned");
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState<"newest" | "name">("newest");
  const [pinnedIds, setPinnedIds] = React.useState<Set<string> | null>(null);
  const pinnedSet = pinnedIds ?? new Set(pinned.data?.items.map((c) => c.id) ?? []);

  const shown = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? feed.items.filter((c) => c.name.toLowerCase().includes(needle) || c.tagline.toLowerCase().includes(needle) || c.tags.some((t) => t.includes(needle))) : feed.items.slice();
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [feed.items, q, sort]);

  if (feed.error && feed.items.length === 0) return <ErrorState description={feed.error} onRetry={feed.refresh} />;
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search favorites" className="pl-9" aria-label="Search favorites" />
        </div>
        <Segmented value={sort} onChange={setSort} options={[{ value: "newest", label: "Newest" }, { value: "name", label: "Name" }]} />
      </div>
      {feed.loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <CharacterCardSkeleton key={i} />)}</div>
      ) : feed.items.length === 0 ? (
        <EmptyState icon={<Heart className="h-8 w-8" />} title="No favorites yet" description="Tap the heart on any character to keep them here." action={<Button href="/explore" variant="secondary">Explore characters</Button>} />
      ) : shown.length === 0 ? (
        <EmptyState title="No matches" description={`Nothing in your favorites matches "${q}".`} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shown.map((c) => (
            <div key={c.id} className="space-y-2">
              <CharacterCard c={c} blur={blur} compactMode />
              <div className="flex gap-1.5">
                <PinButton characterId={c.id} pinned={pinnedSet.has(c.id)} onChange={(p) => setPinnedIds((s) => { const n = new Set(s ?? pinnedSet); if (p) n.add(c.id); else n.delete(c.id); return n; })} />
                <AddToCollectionButton targetType="CHARACTER" targetId={c.id} iconOnly className="h-8 w-8 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      )}
      {feed.offline && <p className="text-center text-xs text-muted">Showing cached favorites — you&apos;re offline.</p>}
      <FeedSentinel onVisible={feed.loadMore} loading={feed.loadingMore} done={feed.done} />
    </div>
  );
}
