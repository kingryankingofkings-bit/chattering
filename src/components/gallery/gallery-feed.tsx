"use client";
import * as React from "react";
import { FolderHeart, Images, Plus, Search, SlidersHorizontal, WifiOff } from "lucide-react";
import { Button, Chip, EmptyState, ErrorState, Field, Input, Segmented, Select, Sheet } from "@/components/ui";
import { FeedSentinel } from "@/components/feed/feed-sentinel";
import { useInfiniteFeed } from "@/components/feed/use-infinite-feed";
import { IntensityPicker, type PickableCharacterItem } from "@/components/content/pickers";
import { ImageCard, ImageCardSkeleton } from "./image-card";
import { ART_STYLES, ORIENTATION_OPTS, TAGS, THEMES } from "@/lib/constants";
import type { ImageCard as Card } from "@/lib/images";

type View = "public" | "mine" | "favorites" | "collections" | "drafts" | "published";
const VIEWS: { value: View; label: string }[] = [
  { value: "public", label: "Public" },
  { value: "mine", label: "My generations" },
  { value: "favorites", label: "Favorites" },
  { value: "collections", label: "Collections" },
  { value: "drafts", label: "Drafts" },
  { value: "published", label: "Published" },
];
const SORTS = [
  { value: "recommended", label: "Recommended" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "most_liked", label: "Most liked" },
  { value: "most_saved", label: "Most saved" },
  { value: "random", label: "Random" },
] as const;
type SortValue = (typeof SORTS)[number]["value"];

export function GalleryFeed({ blur, maxIntensity, characters, initialView }: { blur: boolean; maxIntensity: number; characters: PickableCharacterItem[]; initialView?: View }) {
  const [view, setView] = React.useState<View>(initialView ?? "public");
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [characterId, setCharacterId] = React.useState("");
  const [characterText, setCharacterText] = React.useState("");
  const [creator, setCreator] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  const [style, setStyle] = React.useState("");
  const [orientation, setOrientation] = React.useState("");
  const [range, setRange] = React.useState<"all" | "7d" | "30d">("all");
  const [minLikes, setMinLikes] = React.useState(0);
  const [intensity, setIntensity] = React.useState(maxIntensity);
  const [sort, setSort] = React.useState<SortValue>("recommended");
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [seed] = React.useState(() => Math.floor(Math.random() * 1e9));

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const url = React.useMemo(() => {
    const p = new URLSearchParams({ view: view === "collections" ? "public" : view, sort, limit: "18" });
    if (debounced) p.set("q", debounced);
    if (characterId) p.set("characterId", characterId);
    else if (characterText.trim()) p.set("character", characterText.trim());
    if (creator.trim()) p.set("creator", creator.trim());
    if (tags.length) p.set("tags", tags.join(","));
    if (style) p.set("style", style);
    if (orientation) p.set("orientation", orientation);
    if (range !== "all") p.set("range", range);
    if (minLikes) p.set("minLikes", String(minLikes));
    if (intensity < 3) p.set("maxIntensity", String(intensity));
    if (sort === "random") p.set("seed", String(seed));
    return `/api/images?${p.toString()}`;
  }, [view, sort, debounced, characterId, characterText, creator, tags, style, orientation, range, minLikes, intensity, seed]);

  const feed = useInfiniteFeed<Card>(url, { enabled: view !== "collections" });
  const activeFilters = tags.length + [characterId || characterText, creator, style, orientation, range !== "all", minLikes > 0, intensity < 3].filter(Boolean).length;

  const empty: Record<View, [string, string]> = {
    public: ["Nothing here yet", "Try fewer filters, or generate something and publish it."],
    mine: ["No generations yet", "Everything you generate lands here, private by default."],
    favorites: ["No favorites yet", "Tap the bookmark on any image to save it here."],
    collections: ["", ""],
    drafts: ["No drafts", "Unpublished images you generate will show up here."],
    published: ["Nothing published", "Publish an image from its viewer to see it here."],
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Gallery</h1>
          <p className="text-xs text-muted">Generated art from the community and from you.</p>
        </div>
        <Button href="/gallery/new" size="sm"><Plus className="h-4 w-4" /> Generate</Button>
      </div>

      <Segmented value={view} onChange={setView} options={VIEWS} className="w-full" />

      {view === "collections" ? (
        <EmptyState icon={<FolderHeart className="h-8 w-8" />} title="Your collections" description="Collections live in your Blackbook. Save images into them from any viewer with 'Add to collection'." action={<Button href="/blackbook/collections" size="sm">Open collections</Button>} />
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles, tags or characters" aria-label="Search images" className="pl-9" />
              </div>
              <Select value={sort} onChange={(e) => setSort(e.target.value as SortValue)} aria-label="Sort" className="!w-auto">
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
              <Button variant="secondary" onClick={() => setFiltersOpen(true)} aria-label="Filters">
                <SlidersHorizontal className="h-4 w-4" />
                {activeFilters > 0 && <span className="rounded-full bg-accent px-1.5 text-[10px] text-white">{activeFilters}</span>}
              </Button>
            </div>
            <div className="scrollbar-none flex gap-1 overflow-x-auto">
              <Chip size="sm" active={!style} onClick={() => setStyle("")}>All styles</Chip>
              {ART_STYLES.map((s) => (
                <Chip key={s} size="sm" active={style === s} onClick={() => setStyle(style === s ? "" : s)}>{s}</Chip>
              ))}
            </div>
          </div>

          {feed.offline && <p className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-muted"><WifiOff className="h-3.5 w-3.5" /> You&apos;re offline — showing the last images you saw.</p>}

          {feed.error && feed.items.length === 0 ? (
            <ErrorState description={feed.error} onRetry={() => feed.refresh()} />
          ) : feed.loading ? (
            <div className="masonry">{Array.from({ length: 8 }).map((_, i) => <ImageCardSkeleton key={i} i={i} />)}</div>
          ) : feed.items.length === 0 ? (
            <EmptyState icon={<Images className="h-8 w-8" />} title={empty[view][0]} description={empty[view][1]} action={<Button href="/gallery/new" size="sm">Generate an image</Button>} />
          ) : (
            <div className="masonry">{feed.items.map((c) => <ImageCard key={c.id} c={c} blur={blur} />)}</div>
          )}
          <FeedSentinel onVisible={feed.loadMore} loading={feed.loadingMore} done={feed.done || feed.loading} />
        </>
      )}

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter images" wide>
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Character" hint="Pick one you know, or type a name.">
              <Select value={characterId} onChange={(e) => setCharacterId(e.target.value)}>
                <option value="">Any character</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Character name">
              <Input value={characterText} onChange={(e) => { setCharacterText(e.target.value); if (e.target.value) setCharacterId(""); }} placeholder="e.g. Vesper" maxLength={80} />
            </Field>
            <Field label="Creator name"><Input value={creator} onChange={(e) => setCreator(e.target.value)} placeholder="Display name" maxLength={80} /></Field>
            <Field label="Date">
              <Select value={range} onChange={(e) => setRange(e.target.value as typeof range)}>
                <option value="all">Any time</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </Select>
            </Field>
            <Field label="Popularity">
              <Select value={minLikes} onChange={(e) => setMinLikes(Number(e.target.value))}>
                <option value={0}>Any</option>
                <option value={5}>5+ reactions</option>
                <option value={25}>25+ reactions</option>
                <option value={100}>100+ reactions</option>
              </Select>
            </Field>
            <Field label="Orientation">
              <Select value={orientation} onChange={(e) => setOrientation(e.target.value)}>
                <option value="">Any</option>
                {ORIENTATION_OPTS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Max intensity</p>
            <IntensityPicker value={intensity} onChange={setIntensity} max={maxIntensity} />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {[...THEMES, ...TAGS].map((t) => (
                <Chip key={t} size="sm" active={tags.includes(t)} onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t].slice(0, 8))}>{t}</Chip>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => { setTags([]); setStyle(""); setOrientation(""); setRange("all"); setMinLikes(0); setIntensity(maxIntensity); setCharacterId(""); setCharacterText(""); setCreator(""); }}>Reset</Button>
            <Button className="flex-1" onClick={() => setFiltersOpen(false)}>Show results</Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
