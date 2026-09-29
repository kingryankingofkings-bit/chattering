import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { pagination, parseJsonArray } from "./api";
import { cardInclude, publicCharacterWhere, toCard, viewerMarks, type CharacterCard, type CharacterWithOwner } from "./characters";
import { GENDER_PRESENTATIONS, ORIENTATIONS, PERSONALITIES, ROLE_TYPES, SORTS, TAGS, THEMES, type Sort } from "./constants";
import type { UserPrefs } from "./types";
import { hash32 } from "./utils";
import { buildAffinity, recommendationScore, trendingScore, type Affinity } from "./recommend";

/** Comma-separated (or repeated) query values → deduped string[]. */
const csv = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    const raw = Array.isArray(v) ? v : v ? [v] : [];
    return Array.from(new Set(raw.flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean)));
  });

const oneOf = <T extends readonly string[]>(vocab: T) => csv.transform((arr) => arr.filter((x): x is T[number] => (vocab as readonly string[]).includes(x)));

export const exploreQuerySchema = pagination.extend({
  q: z.string().trim().max(120).optional().default(""),
  sort: z.enum(SORTS).optional().default("recommended"),
  tags: oneOf(TAGS),
  themes: oneOf(THEMES),
  gender: oneOf(GENDER_PRESENTATIONS),
  orientation: oneOf(ORIENTATIONS),
  personality: oneOf(PERSONALITIES),
  role: oneOf(ROLE_TYPES),
  intensity: z.coerce.number().int().min(1).max(3).optional(),
  seed: z.coerce.number().int().min(0).max(2_147_483_647).optional(),
  creator: z.string().max(64).optional(),
});

export type ExploreQuery = z.infer<typeof exploreQuerySchema>;

export type ListCharactersOpts = ExploreQuery & {
  viewerId: string | null;
  prefs: UserPrefs;
};

/** Prisma filter derived from the viewer's own preferences (intensity cap + excluded themes). */
export function prefsWhere(prefs: UserPrefs): Prisma.CharacterWhereInput {
  const where: Prisma.CharacterWhereInput = { intensity: { lte: prefs.maxIntensity } };
  if (prefs.excludedThemes.length) where.AND = prefs.excludedThemes.map((t) => ({ NOT: { themes: { contains: `"${t}"` } } }));
  return where;
}

/** Full-text-ish search across name, creator, tagline/description, tags and themes. Every term must hit somewhere. */
export function searchWhere(q: string): Prisma.CharacterWhereInput[] {
  const terms = q.split(/\s+/).map((t) => t.trim()).filter(Boolean).slice(0, 6);
  return terms.map((term) => ({
    OR: [
      { name: { contains: term } },
      { tagline: { contains: term } },
      { description: { contains: term } },
      { tags: { contains: term } },
      { themes: { contains: term } },
      { owner: { displayName: { contains: term } } },
    ],
  }));
}

function anyOf(column: "tags" | "themes", values: string[]): Prisma.CharacterWhereInput | null {
  if (!values.length) return null;
  return { OR: values.map((v) => ({ [column]: { contains: `"${v}"` } })) };
}

/** Sorts that the database can paginate directly with a stable orderBy. */
const DB_SORTS: Partial<Record<Sort, Prisma.CharacterOrderByWithRelationInput[]>> = {
  newest: [{ createdAt: "desc" }, { id: "desc" }],
  most_chatted: [{ chatCount: "desc" }, { id: "desc" }],
};

/** Bayesian-ish average so a single 5-star vote doesn't beat a 4.7 with 200 votes. */
function ratedScore(c: { ratingSum: number; ratingCount: number }): number {
  const prior = 3.5;
  const weight = 5;
  return (c.ratingSum + prior * weight) / (c.ratingCount + weight) + Math.min(c.ratingCount, 50) / 500;
}

export async function listCharacters(opts: ListCharactersOpts): Promise<{ items: CharacterCard[]; nextCursor: string | null }> {
  const { viewerId, prefs, cursor, limit, q, sort } = opts;
  const base = await publicCharacterWhere(viewerId);
  const and: Prisma.CharacterWhereInput[] = [base, prefsWhere(prefs)];
  if (q) and.push(...searchWhere(q));
  const tags = anyOf("tags", opts.tags);
  const themes = anyOf("themes", opts.themes);
  if (tags) and.push(tags);
  if (themes) and.push(themes);
  if (opts.gender.length) and.push({ genderPresentation: { in: opts.gender } });
  if (opts.orientation.length) and.push({ orientation: { in: opts.orientation } });
  if (opts.personality.length) and.push({ personalityType: { in: opts.personality } });
  if (opts.role.length) and.push({ roleType: { in: opts.role } });
  if (opts.intensity) and.push({ intensity: { lte: opts.intensity } });
  if (opts.creator) and.push({ ownerId: opts.creator });
  const where: Prisma.CharacterWhereInput = { AND: and };

  const dbOrder = DB_SORTS[sort];
  let rows: CharacterWithOwner[];
  let nextCursor: string | null = null;

  if (dbOrder) {
    rows = await prisma.character.findMany({
      where,
      include: cardInclude,
      orderBy: dbOrder,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length > limit) {
      rows = rows.slice(0, limit);
      nextCursor = rows[rows.length - 1].id;
    }
  } else {
    // Computed orderings: score every candidate, sort, then slice after the cursor.
    // The catalog is small enough for SQLite that this is cheaper than a second index.
    const all = await prisma.character.findMany({ where, include: cardInclude });
    const affinity: Affinity | null = sort === "recommended" ? await buildAffinity(viewerId) : null;
    const seed = opts.seed ?? 1;
    const scored = all.map((c) => ({ c, s: scoreFor(sort, c, affinity, seed) }));
    scored.sort((a, b) => b.s - a.s || (a.c.id < b.c.id ? 1 : -1));
    let start = 0;
    if (cursor) {
      const idx = scored.findIndex((x) => x.c.id === cursor);
      start = idx >= 0 ? idx + 1 : 0;
    }
    const page = scored.slice(start, start + limit);
    rows = page.map((x) => x.c);
    nextCursor = start + limit < scored.length && rows.length ? rows[rows.length - 1].id : null;
  }

  const marks = await viewerMarks(viewerId, rows.map((r) => r.id));
  const viewer = viewerId ? { id: viewerId, ...marks } : undefined;
  return { items: rows.map((r) => toCard(r, viewer)), nextCursor };
}

function scoreFor(sort: Sort, c: CharacterWithOwner, affinity: Affinity | null, seed: number): number {
  switch (sort) {
    case "trending":
      return trendingScore(c);
    case "top_rated":
      return ratedScore(c);
    case "random":
      return hash32(`${seed}:${c.id}`);
    case "recommended":
    default: {
      const s = recommendationScore({ tags: parseJsonArray(c.tags), themes: parseJsonArray(c.themes), chatCount: c.chatCount, ratingSum: c.ratingSum, ratingCount: c.ratingCount, ownerId: c.ownerId }, affinity);
      // Already-known (chatted/favorited) characters stay in the feed but sort after every fresh match.
      return affinity?.seen.has(c.id) ? s - 1000 : s;
    }
  }
}

/**
 * Horizontal strip for the top of Explore. Personalised when the viewer has any
 * history (excluding characters they already know); otherwise "Popular right now".
 */
export async function recommendedStrip(viewerId: string | null, prefs: UserPrefs, limit = 10): Promise<{ title: string; subtitle: string; personalized: boolean; items: CharacterCard[] }> {
  const [base, affinity] = await Promise.all([publicCharacterWhere(viewerId), buildAffinity(viewerId)]);
  const where: Prisma.CharacterWhereInput = { AND: [base, prefsWhere(prefs)] };
  const all = await prisma.character.findMany({ where, include: cardInclude, take: 400 });
  const personalized = affinity.hasHistory;
  const pool = personalized ? all.filter((c) => !affinity.seen.has(c.id)) : all;
  const scored = pool.map((c) => ({
    c,
    s: personalized
      ? recommendationScore({ tags: parseJsonArray(c.tags), themes: parseJsonArray(c.themes), chatCount: c.chatCount, ratingSum: c.ratingSum, ratingCount: c.ratingCount, ownerId: c.ownerId }, affinity)
      : trendingScore(c),
  }));
  scored.sort((a, b) => b.s - a.s || (a.c.id < b.c.id ? 1 : -1));
  const rows = scored.slice(0, limit).map((x) => x.c);
  const marks = await viewerMarks(viewerId, rows.map((r) => r.id));
  const viewer = viewerId ? { id: viewerId, ...marks } : undefined;
  return {
    title: personalized ? "Recommended for you" : "Popular right now",
    subtitle: personalized ? "Based on who you've favorited, rated and talked to" : "What everyone's talking to this week",
    personalized,
    items: rows.map((r) => toCard(r, viewer)),
  };
}
