"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Search, Shuffle, SlidersHorizontal, X } from "lucide-react";
import { Button, Chip, Input } from "@/components/ui";
import { SORTS, type Sort } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { CharacterGrid } from "./character-grid";
import { FilterSheet } from "./filter-sheet";
import { activeFilterCount, FACETS, filtersFromParams, filtersToParams, newSeed, SORT_LABELS, type ExploreFilters } from "./filters";

/**
 * Search + sort + filters for Explore. All state lives in the URL search params
 * (native history API, which Next's router syncs with) so back/forward and
 * shared links restore the exact view. Wrap in <Suspense> — uses useSearchParams.
 */
export function ExploreFeed({ blur, maxIntensity }: { blur: boolean; maxIntensity: number }) {
  const searchParams = useSearchParams();
  const filters = React.useMemo(() => filtersFromParams(new URLSearchParams(searchParams.toString())), [searchParams]);
  const [query, setQuery] = React.useState(filters.q);
  const [prevQ, setPrevQ] = React.useState(filters.q);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  // Keep the input in sync when the URL changes from outside (back/forward),
  // without clobbering what the user is mid-typing.
  if (prevQ !== filters.q) {
    setPrevQ(filters.q);
    if (filters.q !== query.trim()) setQuery(filters.q);
  }

  const commit = React.useCallback((next: ExploreFilters, mode: "push" | "replace" = "push") => {
    const sp = filtersToParams(next);
    const url = sp.size ? `?${sp.toString()}` : window.location.pathname;
    if (mode === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }, []);

  // Debounced search → replaceState so typing doesn't spam history entries.
  React.useEffect(() => {
    if (query === filters.q) return;
    const t = setTimeout(() => commit({ ...filters, q: query.trim() }, "replace"), 350);
    return () => clearTimeout(t);
  }, [query, filters, commit]);

  // Random sort needs a stable per-session seed so pagination doesn't shuffle under us.
  React.useEffect(() => {
    if (filters.sort === "random" && !filters.seed) commit({ ...filters, seed: newSeed() }, "replace");
  }, [filters, commit]);

  const setSort = (sort: Sort) => commit({ ...filters, sort, seed: sort === "random" ? newSeed() : null });
  const reshuffle = () => commit({ ...filters, seed: newSeed() }, "replace");
  const removeChip = (facet: (typeof FACETS)[number], v: string) => commit({ ...filters, [facet]: filters[facet].filter((x) => x !== v) });
  const clearAll = () => commit({ ...filters, tags: [], themes: [], gender: [], orientation: [], personality: [], role: [], intensity: null });

  const count = activeFilterCount(filters, maxIntensity);
  const apiUrl = React.useMemo(() => {
    const sp = filtersToParams(filters);
    if (filters.sort === "random" && !filters.seed) return null;
    return `/api/characters${sp.size ? `?${sp.toString()}` : ""}`;
  }, [filters]);

  const chips = FACETS.flatMap((facet) => filters[facet].map((v) => ({ facet, v })));

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search names, creators, scenarios…" aria-label="Search characters" className="pl-9 pr-9" enterKeyHint="search" autoComplete="off" />
          {query && (
            <button type="button" onClick={() => { setQuery(""); commit({ ...filters, q: "" }, "replace"); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:text-fg focus-ring" aria-label="Clear search">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button variant={count ? "primary" : "secondary"} onClick={() => setSheetOpen(true)} aria-label={count ? `Filters, ${count} active` : "Filters"} className="relative shrink-0 px-3">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Filters</span>
          {count > 0 && <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1.5 text-[11px] font-semibold">{count}</span>}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="scrollbar-none -mx-4 flex flex-1 gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="radiogroup" aria-label="Sort by">
          {SORTS.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={filters.sort === s} onClick={() => setSort(s)} className={cn("h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition focus-ring", filters.sort === s ? "border-accent bg-accent-soft text-accent-2" : "border-line bg-surface-2 text-fg-2 hover:border-line-2")}>
              {SORT_LABELS[s]}
            </button>
          ))}
        </div>
        {filters.sort === "random" && (
          <Button variant="ghost" size="sm" onClick={reshuffle} aria-label="Shuffle again" className="shrink-0">
            <Shuffle className="h-3.5 w-3.5" /> Again
          </Button>
        )}
      </div>

      {chips.length > 0 && (
        <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Active filters">
          {chips.map(({ facet, v }) => (
            <Chip key={`${facet}:${v}`} active onClick={() => removeChip(facet, v)} className="pr-1.5">
              {v} <X className="h-3 w-3" aria-hidden />
              <span className="sr-only">Remove {v}</span>
            </Chip>
          ))}
          <button type="button" onClick={clearAll} className="shrink-0 text-xs text-muted underline-offset-2 hover:text-fg hover:underline focus-ring">Clear</button>
        </div>
      )}

      {apiUrl && (
        <CharacterGrid
          url={apiUrl}
          blur={blur}
          emptyTitle={filters.q ? `Nothing for “${filters.q}”` : "No characters match"}
          emptyDescription={count ? "Loosen your filters to see more." : "Try another name, creator or scenario keyword."}
          emptyAction={count ? <Button variant="secondary" size="sm" onClick={clearAll}>Clear filters</Button> : undefined}
        />
      )}

      <FilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} value={filters} maxIntensity={maxIntensity} onApply={(next) => commit(next)} />
    </div>
  );
}
