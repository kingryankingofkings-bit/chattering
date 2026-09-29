import "server-only";
import type { Character, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { decryptJson } from "./crypto";
import { migrateSheet } from "./migrate-data";
import { parseJsonArray } from "./api";
import type { CharacterSheet } from "./types";
import type { PromptCharacter } from "./ai/prompts";

/** Public-safe card shape sent to the client. */
export type CharacterCard = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  pronouns: string;
  avatarUrl: string | null;
  avatarSeed: string;
  tags: string[];
  themes: string[];
  intensity: number;
  genderPresentation: string;
  orientation: string;
  personalityType: string;
  roleType: string;
  visibility: string;
  status: string;
  chatCount: number;
  favoriteCount: number;
  rating: number | null;
  ratingCount: number;
  createdAt: string;
  creator: { id: string; displayName: string };
  isOwner?: boolean;
  isFavorite?: boolean;
  userRating?: number | null;
};

export type CharacterWithOwner = Character & { owner: { id: string; displayName: string } };

export function toCard(c: CharacterWithOwner, viewer?: { id: string; favorites?: Set<string>; ratings?: Map<string, number> }): CharacterCard {
  return {
    id: c.id,
    name: c.name,
    tagline: c.tagline,
    description: c.description,
    pronouns: c.pronouns,
    avatarUrl: c.avatarMediaId ? `/api/media/${c.avatarMediaId}` : null,
    avatarSeed: c.avatarSeed || c.id,
    tags: parseJsonArray(c.tags),
    themes: parseJsonArray(c.themes),
    intensity: c.intensity,
    genderPresentation: c.genderPresentation,
    orientation: c.orientation,
    personalityType: c.personalityType,
    roleType: c.roleType,
    visibility: c.visibility,
    status: c.status,
    chatCount: c.chatCount,
    favoriteCount: c.favoriteCount,
    rating: c.ratingCount > 0 ? Math.round((c.ratingSum / c.ratingCount) * 10) / 10 : null,
    ratingCount: c.ratingCount,
    createdAt: c.createdAt.toISOString(),
    creator: { id: c.owner.id, displayName: c.owner.displayName },
    isOwner: viewer ? c.ownerId === viewer.id : undefined,
    isFavorite: viewer?.favorites ? viewer.favorites.has(c.id) : undefined,
    userRating: viewer?.ratings ? viewer.ratings.get(c.id) ?? null : undefined,
  };
}

export function getSheet(c: Character): CharacterSheet {
  return migrateSheet(decryptJson<Partial<CharacterSheet> | null>(c.sheetEnc, null));
}

export function toPromptCharacter(c: Character): PromptCharacter {
  return {
    name: c.name,
    tagline: c.tagline,
    description: c.description,
    pronouns: c.pronouns,
    identity: c.identity,
    appearance: c.appearance,
    statedAge: c.statedAge,
    tags: parseJsonArray(c.tags),
    themes: parseJsonArray(c.themes),
    intensity: c.intensity,
    allowedDynamics: parseJsonArray(c.allowedDynamics),
    prohibitedTopics: parseJsonArray(c.prohibitedTopics),
    responseStyle: c.responseStyle,
    messageLength: c.messageLength,
  };
}

/** Can this viewer see this character at all? */
export function canView(c: Character, viewerId: string | null, isMod = false): boolean {
  if (c.ownerId === viewerId || isMod) return true;
  if (c.status !== "ACTIVE") return false;
  return c.visibility === "PUBLIC" || c.visibility === "UNLISTED";
}

/** Prisma filter for characters a viewer may browse in public feeds. */
export async function publicCharacterWhere(viewerId: string | null): Promise<Prisma.CharacterWhereInput> {
  const where: Prisma.CharacterWhereInput = { visibility: "PUBLIC", status: "ACTIVE", ageConfirmed: true, statedAge: { gte: 18 } };
  if (viewerId) {
    const [blocks, hidden] = await Promise.all([
      prisma.block.findMany({ where: { userId: viewerId }, select: { blockedUserId: true } }),
      prisma.hiddenTag.findMany({ where: { userId: viewerId }, select: { tag: true } }),
    ]);
    const and: Prisma.CharacterWhereInput[] = [];
    if (blocks.length) and.push({ ownerId: { notIn: blocks.map((b) => b.blockedUserId) } });
    for (const h of hidden) and.push({ NOT: { tags: { contains: `"${h.tag}"` } } });
    if (and.length) where.AND = and;
  }
  return where;
}

export async function viewerMarks(viewerId: string | null, characterIds: string[]) {
  if (!viewerId || characterIds.length === 0) return { favorites: new Set<string>(), ratings: new Map<string, number>() };
  const [favs, ratings] = await Promise.all([
    prisma.favorite.findMany({ where: { userId: viewerId, characterId: { in: characterIds } }, select: { characterId: true } }),
    prisma.rating.findMany({ where: { userId: viewerId, characterId: { in: characterIds } }, select: { characterId: true, score: true } }),
  ]);
  return { favorites: new Set(favs.map((f) => f.characterId)), ratings: new Map(ratings.map((r) => [r.characterId, r.score])) };
}

export const cardInclude = { owner: { select: { id: true, displayName: true } } } as const;
