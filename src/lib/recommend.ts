import "server-only";
import { prisma } from "./db";
import { parseJsonArray } from "./api";

/**
 * Personalised scoring. Affinity weights are built from what the viewer has
 * favorited, rated 4+ and chatted with; characters are then scored by how much
 * their tags/themes overlap those weights, plus popularity and rating bonuses.
 */
export type Affinity = {
  tags: Map<string, number>;
  themes: Map<string, number>;
  creators: Map<string, number>;
  /** Characters the viewer already chatted with or favorited. */
  seen: Set<string>;
  hasHistory: boolean;
};

export const emptyAffinity = (): Affinity => ({ tags: new Map(), themes: new Map(), creators: new Map(), seen: new Set(), hasHistory: false });

const bump = (m: Map<string, number>, key: string, w: number) => m.set(key, (m.get(key) ?? 0) + w);

export async function buildAffinity(viewerId: string | null): Promise<Affinity> {
  const aff = emptyAffinity();
  if (!viewerId) return aff;
  const sel = { id: true, ownerId: true, tags: true, themes: true } as const;
  const [favs, ratings, chats] = await Promise.all([
    prisma.favorite.findMany({ where: { userId: viewerId }, select: { character: { select: sel } }, take: 200 }),
    prisma.rating.findMany({ where: { userId: viewerId, score: { gte: 4 } }, select: { score: true, character: { select: sel } }, take: 200 }),
    prisma.chat.findMany({ where: { userId: viewerId, isPreview: false }, select: { messageCount: true, character: { select: sel } }, orderBy: { lastMessageAt: "desc" }, take: 200 }),
  ]);
  const add = (c: { id: string; ownerId: string; tags: string; themes: string }, w: number, markSeen: boolean) => {
    for (const t of parseJsonArray(c.tags)) bump(aff.tags, t, w);
    for (const t of parseJsonArray(c.themes)) bump(aff.themes, t, w * 1.2);
    bump(aff.creators, c.ownerId, w * 0.5);
    if (markSeen) aff.seen.add(c.id);
  };
  for (const f of favs) add(f.character, 1.5, true);
  for (const r of ratings) add(r.character, r.score === 5 ? 1.5 : 1, false);
  for (const ch of chats) add(ch.character, ch.messageCount >= 10 ? 1.5 : 1, true);
  aff.hasHistory = favs.length + ratings.length + chats.length > 0;
  // Normalise so a heavy user and a light user land on the same scale.
  for (const m of [aff.tags, aff.themes, aff.creators]) {
    const max = Math.max(0, ...m.values());
    if (max > 0) for (const [k, v] of m) m.set(k, v / max);
  }
  return aff;
}

export type Scorable = { tags: string[]; themes: string[]; chatCount: number; ratingSum: number; ratingCount: number; ownerId: string };

/** affinity overlap + log(chatCount) + rating bonus. Works without history too (falls back to popularity). */
export function recommendationScore(c: Scorable, aff: Affinity | null): number {
  let overlap = 0;
  if (aff?.hasHistory) {
    for (const t of c.tags) overlap += aff.tags.get(t) ?? 0;
    for (const t of c.themes) overlap += aff.themes.get(t) ?? 0;
    overlap += aff.creators.get(c.ownerId) ?? 0;
  }
  const popularity = Math.log1p(c.chatCount) * 0.6;
  const avg = c.ratingCount ? c.ratingSum / c.ratingCount : 0;
  const ratingBonus = c.ratingCount ? ((avg - 3) / 2) * Math.min(1, c.ratingCount / 5) : 0;
  return overlap * 2 + popularity + ratingBonus;
}

/** Engagement weighted by recency: a new character with a few chats can outrank an old one with many. */
export function trendingScore(c: { chatCount: number; favoriteCount: number; ratingCount: number; createdAt: Date; updatedAt: Date }): number {
  const engagement = c.chatCount + c.favoriteCount * 2 + c.ratingCount * 0.5 + 1;
  const ageDays = Math.max(0, (Date.now() - c.createdAt.getTime()) / 86_400_000);
  const activeDays = Math.max(0, (Date.now() - c.updatedAt.getTime()) / 86_400_000);
  return engagement / Math.pow(ageDays + 2, 0.7) + engagement / Math.pow(activeDays + 2, 1.2) * 0.3;
}
