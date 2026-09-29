"use client";
import * as React from "react";
import { BookOpen, Plus, Search, SlidersHorizontal, WifiOff } from "lucide-react";
import { Button, Chip, EmptyState, ErrorState, Input, Segmented, Select, Sheet } from "@/components/ui";
import { FeedSentinel } from "@/components/feed/feed-sentinel";
import { useInfiniteFeed } from "@/components/feed/use-infinite-feed";
import { IntensityPicker } from "@/components/content/pickers";
import { StoryCard, StoryCardSkeleton } from "./story-card";
import { GENRES, STORY_LENGTHS, TAGS, THEMES } from "@/lib/constants";
import type { StoryCard as Card } from "@/lib/stories";

const SORTS = [
  { value: "recommended", label: "Recommended" },
  { value: "popular", label: "Popular" },
  { value: "newest", label: "Newest" },
  { value: "trending", label: "Trending" },
  { value: "random", label: "Random" },
] as const;
type SortValue = (typeof SORTS)[number]["value"];

export function StoryBrowse({ maxIntensity }: { maxIntensity: number }) {
  const [view, setView] = React.useState<"public" | "mine">("public");
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [genre, setGenre] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  const [length, setLength] = React.useState("");
  const [intensity, setIntensity] = React.useState(maxIntensity);
  const [sort, setSort] = React.useState<SortValue>("recommended");
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [seed] = React.useState(() => Math.floor(Math.random() * 1e9));

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const url = React.useMemo(() => {
    const p = new URLSearchParams({ view, sort, limit: "12" });
    if (debounced) p.set("q", debounced);
    if (genre) p.set("genre", genre);
    if (tags.length) p.set("tags", tags.join(","));
    if (length) p.set("length", length);
    if (intensity < 3) p.set("maxIntensity", String(intensity));
    if (sort === "random") p.set("seed", String(seed));
    return `/api/stories?${p.toString()}`;
  }, [view, sort, debounced, genre, tags, length, intensity, seed]);

  const feed = useInfiniteFeed<Card>(url);
  const activeFilters = tags.length + (genre ? 1 : 0) + (length ? 1 : 0) + (intensity < 3 ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Stories</h1>
          <p className="text-xs text-muted">Long-form fiction, written for grown-ups.</p>
        </div>
        <Button href="/stories/new" size="sm"><Plus className="h-4 w-4" /> Write a story</Button>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles, summaries or tags" aria-label="Search stories" className="pl-9" />
          </div>
          <Button variant="secondary" onClick={() => setFiltersOpen(true)} aria-label="Filters">
            <SlidersHorizontal className="h-4 w-4" />
            {activeFilters > 0 && <span className="rounded-full bg-accent px-1.5 text-[10px] text-white">{activeFilters}</span>}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Segmented value={view} onChange={setView} options={[{ value: "public", label: "Public" }, { value: "mine", label: "Mine" }]} />
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortValue)} aria-label="Sort" className="!w-auto !py-1.5 text-xs">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
        </div>
        <div className="scrollbar-none flex gap-1 overflow-x-auto">
          <Chip size="sm" active={!genre} onClick={() => setGenre("")}>All genres</Chip>
          {GENRES.map((g) => (
            <Chip key={g} size="sm" active={genre === g} onClick={() => setGenre(genre === g ? "" : g)}>{g}</Chip>
          ))}
        </div>
      </div>

      {feed.offline && <p className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-muted"><WifiOff className="h-3.5 w-3.5" /> You&apos;re offline — showing the last stories you saw.</p>}

      {feed.error && feed.items.length === 0 ? (
        <ErrorState description={feed.error} onRetry={() => feed.refresh()} />
      ) : feed.loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <StoryCardSkeleton key={i} />)}</div>
      ) : feed.items.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-8 w-8" />} title={view === "mine" ? "No stories yet" : "Nothing here yet"} description={view === "mine" ? "Your drafts and published stories will show up here." : "Try fewer filters, or write the first one."} action={<Button href="/stories/new" size="sm">Write a story</Button>} />
      ) : (
        <div className="space-y-3">{feed.items.map((s) => <StoryCard key={s.id} c={s} />)}</div>
      )}
      <FeedSentinel onVisible={feed.loadMore} loading={feed.loadingMore} done={feed.done || feed.loading} />

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter stories">
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Length</p>
            <div className="flex flex-wrap gap-1.5">
              <Chip active={!length} onClick={() => setLength("")}>Any</Chip>
              {STORY_LENGTHS.map((l) => (
                <Chip key={l} active={length === l} onClick={() => setLength(length === l ? "" : l)}>{l}</Chip>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Max intensity</p>
            <IntensityPicker value={intensity} onChange={setIntensity} max={maxIntensity} />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Themes & tags</p>
            <div className="flex flex-wrap gap-1.5">
              {[...THEMES, ...TAGS].map((t) => (
                <Chip key={t} size="sm" active={tags.includes(t)} onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t].slice(0, 8))}>{t}</Chip>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => { setTags([]); setLength(""); setIntensity(maxIntensity); setGenre(""); }}>Reset</Button>
            <Button className="flex-1" onClick={() => setFiltersOpen(false)}>Show results</Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
