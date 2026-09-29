import { SORTS, type Sort } from "@/lib/constants";

/** Explore state, mirrored 1:1 into the URL search params so back/forward works. */
export type ExploreFilters = {
  q: string;
  sort: Sort;
  tags: string[];
  themes: string[];
  gender: string[];
  orientation: string[];
  personality: string[];
  role: string[];
  intensity: number | null;
  seed: number | null;
};

export const FACETS = ["tags", "themes", "gender", "orientation", "personality", "role"] as const;
export type Facet = (typeof FACETS)[number];

export const SORT_LABELS: Record<Sort, string> = {
  recommended: "For you",
  trending: "Trending",
  newest: "Newest",
  most_chatted: "Most chatted",
  top_rated: "Top rated",
  random: "Shuffle",
};

export function emptyFilters(): ExploreFilters {
  return { q: "", sort: "recommended", tags: [], themes: [], gender: [], orientation: [], personality: [], role: [], intensity: null, seed: null };
}

const list = (v: string | null) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);

export function filtersFromParams(sp: URLSearchParams): ExploreFilters {
  const sort = sp.get("sort");
  const intensity = Number(sp.get("intensity"));
  const seed = Number(sp.get("seed"));
  return {
    q: sp.get("q") ?? "",
    sort: (SORTS as readonly string[]).includes(sort ?? "") ? (sort as Sort) : "recommended",
    tags: list(sp.get("tags")),
    themes: list(sp.get("themes")),
    gender: list(sp.get("gender")),
    orientation: list(sp.get("orientation")),
    personality: list(sp.get("personality")),
    role: list(sp.get("role")),
    intensity: intensity >= 1 && intensity <= 3 ? intensity : null,
    seed: Number.isInteger(seed) && seed > 0 ? seed : null,
  };
}

export function filtersToParams(f: ExploreFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.sort !== "recommended") sp.set("sort", f.sort);
  for (const facet of FACETS) if (f[facet].length) sp.set(facet, f[facet].join(","));
  if (f.intensity) sp.set("intensity", String(f.intensity));
  if (f.sort === "random" && f.seed) sp.set("seed", String(f.seed));
  return sp;
}

/** Number of active filter values (what the Filters button badge shows). */
export function activeFilterCount(f: ExploreFilters, maxIntensity: number): number {
  return FACETS.reduce((n, facet) => n + f[facet].length, 0) + (f.intensity && f.intensity < maxIntensity ? 1 : 0);
}

export function newSeed(): number {
  return (Math.floor(Math.random() * 2_147_483_646) + 1) >>> 0;
}
