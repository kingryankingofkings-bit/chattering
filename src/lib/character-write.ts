import "server-only";
import type { Character } from "@prisma/client";
import { prisma } from "./db";
import { ApiError, parseJsonArray } from "./api";
import { encryptJson } from "./crypto";
import { checkAge, checkFields } from "./safety";
import { getSheet } from "./characters";
import { sheetFromInput, type CharacterFull, type CharacterInput } from "./character-schema";
import type { EngagementStats } from "./types";

/**
 * Character creation / editing. Runs every user-authored field through the
 * safety filter, enforces the 18+ / fiction confirmations before anything can
 * be published, encrypts the private sheet and keeps avatar media visibility in
 * sync with the character's visibility.
 */

export function validateCharacterInput(input: CharacterInput) {
  const s = input.sheet;
  const safety = checkFields({
    name: input.name,
    tagline: input.tagline,
    description: input.description,
    pronouns: input.pronouns,
    identity: input.identity,
    appearance: input.appearance,
    tags: input.tags,
    themes: input.themes,
    genderPresentation: input.genderPresentation,
    orientation: input.orientation,
    personalityType: input.personalityType,
    roleType: input.roleType,
    allowedDynamics: input.allowedDynamics,
    prohibitedTopics: input.prohibitedTopics,
    personality: s.personality,
    behavior: s.behavior,
    speakingStyle: s.speakingStyle,
    likes: s.likes,
    dislikes: s.dislikes,
    boundaries: s.boundaries,
    backstory: s.backstory,
    relationshipStyle: s.relationshipStyle,
    goals: s.goals,
    scenario: s.scenario,
    setting: s.setting,
    openingMessage: s.openingMessage,
    exampleDialogue: s.exampleDialogue,
    lorebook: s.lorebook.map((l) => `${l.key} ${l.content}`),
    memories: s.memories,
  });
  if (!safety.ok) throw new ApiError(422, safety.reason, { category: safety.category, field: safety.field });
  const age = checkAge(input.statedAge);
  if (!age.ok) throw new ApiError(422, age.reason, { category: age.category, field: "statedAge" });
  if (input.visibility !== "PRIVATE") {
    if (!input.ageConfirmed) throw new ApiError(422, "Confirm the character is 18+ before publishing.", { field: "ageConfirmed" });
    if (!input.fictionConfirmed) throw new ApiError(422, "Confirm the character is fictional before publishing.", { field: "fictionConfirmed" });
  }
}

async function assertOwnedMedia(mediaId: string | null, userId: string) {
  if (!mediaId) return;
  const m = await prisma.media.findUnique({ where: { id: mediaId }, select: { ownerId: true } });
  if (!m || m.ownerId !== userId) throw new ApiError(400, "That avatar image isn't yours.", { field: "avatarMediaId" });
}

/** Published characters need a publicly readable avatar. */
export async function syncAvatarVisibility(mediaId: string | null, visibility: string) {
  if (!mediaId) return;
  if (visibility === "PUBLIC" || visibility === "UNLISTED") {
    await prisma.media.updateMany({ where: { id: mediaId, visibility: "PRIVATE" }, data: { visibility: "PUBLIC" } });
  }
}

function toRow(input: CharacterInput) {
  return {
    name: input.name,
    tagline: input.tagline,
    description: input.description,
    pronouns: input.pronouns || "they/them",
    identity: input.identity,
    appearance: input.appearance,
    avatarMediaId: input.avatarMediaId,
    avatarSeed: input.avatarSeed,
    statedAge: input.statedAge,
    ageConfirmed: input.ageConfirmed,
    fictionConfirmed: input.fictionConfirmed,
    sheetEnc: encryptJson(sheetFromInput(input.sheet)),
    tags: JSON.stringify(input.tags),
    themes: JSON.stringify(input.themes),
    genderPresentation: input.genderPresentation,
    orientation: input.orientation,
    personalityType: input.personalityType,
    roleType: input.roleType,
    intensity: input.intensity,
    allowedDynamics: JSON.stringify(input.allowedDynamics),
    prohibitedTopics: JSON.stringify(input.prohibitedTopics),
    responseStyle: input.responseStyle,
    messageLength: input.messageLength,
    visibility: input.visibility,
  };
}

export async function createCharacter(userId: string, input: CharacterInput): Promise<Character> {
  validateCharacterInput(input);
  await assertOwnedMedia(input.avatarMediaId, userId);
  const row = await prisma.character.create({ data: { ownerId: userId, ...toRow(input) } });
  await syncAvatarVisibility(row.avatarMediaId, row.visibility);
  return row;
}

export async function requireOwnedCharacter(id: string, userId: string): Promise<Character> {
  const c = await prisma.character.findUnique({ where: { id } });
  if (!c || c.ownerId !== userId) throw new ApiError(404, "Character not found");
  return c;
}

export async function updateCharacter(userId: string, id: string, input: CharacterInput): Promise<Character> {
  const existing = await requireOwnedCharacter(id, userId);
  validateCharacterInput(input);
  await assertOwnedMedia(input.avatarMediaId, userId);
  // A character hidden/removed by moderation cannot be re-published by its owner.
  const visibility = existing.status !== "ACTIVE" && input.visibility !== "PRIVATE" ? existing.visibility : input.visibility;
  if (existing.status !== "ACTIVE" && input.visibility !== "PRIVATE" && existing.visibility === "PRIVATE") {
    throw new ApiError(403, "This character was hidden by moderation and can't be published. You can appeal from your Blackbook.");
  }
  const row = await prisma.character.update({ where: { id }, data: { ...toRow(input), visibility } });
  await syncAvatarVisibility(row.avatarMediaId, row.visibility);
  return row;
}

export async function deleteCharacter(userId: string, id: string) {
  await requireOwnedCharacter(id, userId);
  await prisma.character.delete({ where: { id } });
}

export async function duplicateCharacter(userId: string, id: string): Promise<Character> {
  const src = await requireOwnedCharacter(id, userId);
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = src;
  void _id; void _c; void _u;
  return prisma.character.create({
    data: {
      ...rest,
      name: `${src.name} (copy)`.slice(0, 60),
      visibility: "PRIVATE",
      status: "ACTIVE",
      chatCount: 0,
      messageCount: 0,
      favoriteCount: 0,
      ratingSum: 0,
      ratingCount: 0,
      viewCount: 0,
    },
  });
}

export function toFull(c: Character): CharacterFull {
  const sheet = getSheet(c);
  const { version: _v, ...sheetFields } = sheet;
  void _v;
  return {
    id: c.id,
    name: c.name,
    tagline: c.tagline,
    description: c.description,
    pronouns: c.pronouns,
    identity: c.identity,
    appearance: c.appearance,
    avatarMediaId: c.avatarMediaId,
    avatarUrl: c.avatarMediaId ? `/api/media/${c.avatarMediaId}` : null,
    avatarSeed: c.avatarSeed || c.id,
    statedAge: c.statedAge,
    ageConfirmed: c.ageConfirmed,
    fictionConfirmed: c.fictionConfirmed,
    tags: parseJsonArray(c.tags),
    themes: parseJsonArray(c.themes),
    genderPresentation: c.genderPresentation,
    orientation: c.orientation,
    personalityType: c.personalityType,
    roleType: c.roleType,
    intensity: c.intensity,
    allowedDynamics: parseJsonArray(c.allowedDynamics),
    prohibitedTopics: parseJsonArray(c.prohibitedTopics),
    responseStyle: c.responseStyle as CharacterFull["responseStyle"],
    messageLength: c.messageLength as CharacterFull["messageLength"],
    visibility: c.visibility as CharacterFull["visibility"],
    status: c.status,
    sheet: sheetFields,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

/** Engagement stats from the denormalized counters, cross-checked against live counts. */
export async function characterStats(c: Character): Promise<EngagementStats> {
  const [chats, msgs] = await Promise.all([
    prisma.chat.count({ where: { characterId: c.id, isPreview: false } }),
    prisma.chat.aggregate({ where: { characterId: c.id, isPreview: false }, _sum: { messageCount: true } }),
  ]);
  return {
    chats: Math.max(c.chatCount, chats),
    messages: Math.max(c.messageCount, msgs._sum.messageCount ?? 0),
    favorites: c.favoriteCount,
    rating: c.ratingCount > 0 ? Math.round((c.ratingSum / c.ratingCount) * 10) / 10 : null,
    ratingCount: c.ratingCount,
    views: c.viewCount,
  };
}

/** Bulk stats for the owner's list (one query per table instead of per character). */
export async function statsForMany(rows: Character[]): Promise<Record<string, EngagementStats>> {
  if (rows.length === 0) return {};
  const ids = rows.map((r) => r.id);
  const grouped = await prisma.chat.groupBy({ by: ["characterId"], where: { characterId: { in: ids }, isPreview: false }, _count: { _all: true }, _sum: { messageCount: true } });
  const byId = new Map(grouped.map((g) => [g.characterId, g]));
  const out: Record<string, EngagementStats> = {};
  for (const c of rows) {
    const g = byId.get(c.id);
    out[c.id] = {
      chats: Math.max(c.chatCount, g?._count._all ?? 0),
      messages: Math.max(c.messageCount, g?._sum.messageCount ?? 0),
      favorites: c.favoriteCount,
      rating: c.ratingCount > 0 ? Math.round((c.ratingSum / c.ratingCount) * 10) / 10 : null,
      ratingCount: c.ratingCount,
      views: c.viewCount,
    };
  }
  return out;
}

/** Full export payload (owner only): everything including the private sheet. */
export function toExport(c: Character) {
  return { format: "chattering.character", version: 1, exportedAt: new Date().toISOString(), character: toFull(c) };
}
