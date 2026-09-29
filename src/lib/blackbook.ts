import "server-only";
import { z } from "zod";
import type { Comic, GeneratedImage, Story, SavedEncounter, Character, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { decryptJson, decryptString } from "./crypto";
import { migratePrefs } from "./migrate-data";
import { cardInclude, toCard, viewerMarks, type CharacterCard } from "./characters";
import type { SafeUser } from "./auth";
import { defaultNotificationPrefs, defaultPrefs, type EncounterData, type NotificationPrefs, type UserPrefs } from "./types";

/* ---------- Profile ---------- */

export type MeDto = {
  id: string;
  email: string;
  displayName: string;
  bio: string;
  avatarMediaId: string | null;
  avatarUrl: string | null;
  role: string;
  subscriptionTier: string;
  subscriptionRenewsAt: string | null;
  createdAt: string;
};

export function toMe(u: SafeUser): MeDto {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    bio: u.bioEnc ? safeDecrypt(u.bioEnc) : "",
    avatarMediaId: u.avatarMediaId,
    avatarUrl: u.avatarMediaId ? `/api/media/${u.avatarMediaId}` : null,
    role: u.role,
    subscriptionTier: u.subscriptionTier,
    subscriptionRenewsAt: u.subscriptionRenewsAt ? u.subscriptionRenewsAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
  };
}

function safeDecrypt(v: string) {
  try {
    return decryptString(v);
  } catch {
    return "";
  }
}

export function userPrefs(u: { prefsEnc: string | null }): UserPrefs {
  return migratePrefs(decryptJson<Partial<UserPrefs> | null>(u.prefsEnc, defaultPrefs()));
}

export function notificationPrefs(u: { notificationPrefs: string }): NotificationPrefs {
  try {
    return { ...defaultNotificationPrefs(), ...(JSON.parse(u.notificationPrefs || "{}") as Partial<NotificationPrefs>) };
  } catch {
    return defaultNotificationPrefs();
  }
}

/* ---------- Content item shapes (minimal, list-friendly) ---------- */

export type ComicItem = { id: string; title: string; coverUrl: string | null; status: string; visibility: string; pageCount: number; updatedAt: string };
export type StoryItem = { id: string; title: string; summary: string; status: string; visibility: string; wordCount: number; updatedAt: string };
export type ImageItem = { id: string; title: string; url: string; status: string; visibility: string; orientation: string; createdAt: string };
export type EncounterItem = { id: string; name: string; isTemplate: boolean; createdAt: string; character: { id: string; name: string; avatarUrl: string | null; avatarSeed: string }; data: EncounterData };

export function toComicItem(c: Comic): ComicItem {
  return { id: c.id, title: c.title, coverUrl: c.coverMediaId ? `/api/media/${c.coverMediaId}` : null, status: c.status, visibility: c.visibility, pageCount: c.pageCount, updatedAt: c.updatedAt.toISOString() };
}
export function toStoryItem(s: Story): StoryItem {
  return { id: s.id, title: s.title, summary: s.summary, status: s.status, visibility: s.visibility, wordCount: s.wordCount, updatedAt: s.updatedAt.toISOString() };
}
export function toImageItem(i: GeneratedImage): ImageItem {
  return { id: i.id, title: i.title, url: `/api/media/${i.mediaId}`, status: i.status, visibility: i.visibility, orientation: i.orientation, createdAt: i.createdAt.toISOString() };
}
export function toEncounterItem(e: SavedEncounter & { character: Pick<Character, "id" | "name" | "avatarMediaId" | "avatarSeed"> }): EncounterItem {
  const fallback: EncounterData = { version: 1, scenarioTitle: e.name, setting: "", hook: "", openingMessage: "", intensity: 2, themes: [], tags: [] };
  return {
    id: e.id,
    name: e.name,
    isTemplate: e.isTemplate,
    createdAt: e.createdAt.toISOString(),
    character: { id: e.character.id, name: e.character.name, avatarUrl: e.character.avatarMediaId ? `/api/media/${e.character.avatarMediaId}` : null, avatarSeed: e.character.avatarSeed || e.character.id },
    data: { ...fallback, ...decryptJson<Partial<EncounterData>>(e.dataEnc, {}) },
  };
}

/** Content another user may see: theirs, or published + moderation-clean. */
export function visibleContentWhere(viewerId: string) {
  return { OR: [{ authorId: viewerId }, { visibility: { in: ["PUBLIC", "UNLISTED"] }, modStatus: "ACTIVE", status: "PUBLISHED" }] };
}
export function visibleImageWhere(viewerId: string) {
  return { OR: [{ ownerId: viewerId }, { visibility: { in: ["PUBLIC", "UNLISTED"] }, modStatus: "ACTIVE", status: "PUBLISHED" }] };
}

/* ---------- Collections ---------- */

export type CollectionTargetType = "CHARACTER" | "COMIC" | "STORY" | "IMAGE" | "ENCOUNTER";
export type CollectionItemDto = {
  targetType: CollectionTargetType;
  targetId: string;
  position: number;
  addedAt: string;
  item: CharacterCard | ComicItem | StoryItem | ImageItem | EncounterItem | null;
};

/** Resolve collection rows to display shapes, dropping nothing (missing targets come back as `item: null`). */
export async function resolveCollectionItems(rows: { targetType: string; targetId: string; position: number; addedAt: Date }[], viewerId: string): Promise<CollectionItemDto[]> {
  const ids = (t: string) => rows.filter((r) => r.targetType === t).map((r) => r.targetId);
  const charIds = ids("CHARACTER");
  const [chars, marks, comics, stories, images, encounters] = await Promise.all([
    charIds.length ? prisma.character.findMany({ where: { id: { in: charIds }, OR: [{ ownerId: viewerId }, { status: "ACTIVE", visibility: { in: ["PUBLIC", "UNLISTED"] } }] }, include: cardInclude }) : [],
    viewerMarks(viewerId, charIds),
    ids("COMIC").length ? prisma.comic.findMany({ where: { id: { in: ids("COMIC") }, ...visibleContentWhere(viewerId) } }) : [],
    ids("STORY").length ? prisma.story.findMany({ where: { id: { in: ids("STORY") }, ...visibleContentWhere(viewerId) } }) : [],
    ids("IMAGE").length ? prisma.generatedImage.findMany({ where: { id: { in: ids("IMAGE") }, ...visibleImageWhere(viewerId) } }) : [],
    ids("ENCOUNTER").length ? prisma.savedEncounter.findMany({ where: { id: { in: ids("ENCOUNTER") }, userId: viewerId }, include: { character: { select: { id: true, name: true, avatarMediaId: true, avatarSeed: true } } } }) : [],
  ]);
  const lookup = new Map<string, CollectionItemDto["item"]>();
  for (const c of chars) lookup.set(`CHARACTER:${c.id}`, toCard(c, { id: viewerId, ...marks }));
  for (const c of comics) lookup.set(`COMIC:${c.id}`, toComicItem(c));
  for (const s of stories) lookup.set(`STORY:${s.id}`, toStoryItem(s));
  for (const i of images) lookup.set(`IMAGE:${i.id}`, toImageItem(i));
  for (const e of encounters) lookup.set(`ENCOUNTER:${e.id}`, toEncounterItem(e));
  return rows
    .slice()
    .sort((a, b) => a.position - b.position || a.addedAt.getTime() - b.addedAt.getTime())
    .map((r) => ({ targetType: r.targetType as CollectionTargetType, targetId: r.targetId, position: r.position, addedAt: r.addedAt.toISOString(), item: lookup.get(`${r.targetType}:${r.targetId}`) ?? null }));
}

/** Checks a collection target exists and is visible to the viewer. */
export async function assertCollectible(targetType: CollectionTargetType, targetId: string, viewerId: string) {
  let ok = false;
  switch (targetType) {
    case "CHARACTER": {
      const c = await prisma.character.findUnique({ where: { id: targetId } });
      ok = !!c && (c.ownerId === viewerId || (c.status === "ACTIVE" && c.visibility !== "PRIVATE"));
      break;
    }
    case "COMIC":
      ok = !!(await prisma.comic.findFirst({ where: { id: targetId, ...visibleContentWhere(viewerId) }, select: { id: true } }));
      break;
    case "STORY":
      ok = !!(await prisma.story.findFirst({ where: { id: targetId, ...visibleContentWhere(viewerId) }, select: { id: true } }));
      break;
    case "IMAGE":
      ok = !!(await prisma.generatedImage.findFirst({ where: { id: targetId, ...visibleImageWhere(viewerId) }, select: { id: true } }));
      break;
    case "ENCOUNTER":
      ok = !!(await prisma.savedEncounter.findFirst({ where: { id: targetId, userId: viewerId }, select: { id: true } }));
      break;
  }
  return ok;
}

export type CollectionDto = { id: string; name: string; description: string; itemCount: number; updatedAt: string };

export async function listCollections(userId: string): Promise<CollectionDto[]> {
  const rows = await prisma.collection.findMany({ where: { userId }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], include: { _count: { select: { items: true } } } });
  return rows.map((c) => ({ id: c.id, name: c.name, description: c.description, itemCount: c._count.items, updatedAt: c.updatedAt.toISOString() }));
}

export type CollectionWhere = Prisma.CollectionWhereInput;

export const collectionSchema = z.object({ name: z.string().trim().min(1, "Name your collection").max(60), description: z.string().trim().max(300).default("") });
