import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { decryptJson, decryptString } from "./crypto";
import { defaultPrefs, type UserPrefs } from "./types";
import { isModerator, type SafeUser } from "./auth";
import { ApiError, parseJsonArray } from "./api";
import { migratePrefs } from "./migrate-data";
import { mulberry32 } from "./utils";
import { canView, getSheet } from "./characters";
import { getTextProvider } from "./ai";
import { buildSummaryPrompt } from "./ai/prompts";
import type { TextUsage } from "./ai/types";

/* ------------------------------------------------------------------ */
/* Vocabulary                                                          */
/* ------------------------------------------------------------------ */

export const CONTENT_TYPES = ["comic", "story", "image"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];
export const CONTENT_TARGET: Record<ContentType, "COMIC" | "STORY" | "IMAGE"> = { comic: "COMIC", story: "STORY", image: "IMAGE" };
export const REACTION_KINDS = ["like", "fire", "heart", "wow"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];
export const CONTENT_SORTS = ["recommended", "trending", "newest", "oldest", "popular", "most_liked", "most_saved", "random"] as const;
export type ContentSort = (typeof CONTENT_SORTS)[number];

export const authorSelect = { id: true, displayName: true } as const;
export type Author = { id: string; displayName: string };
export type CharacterLink = { id: string; name: string; avatarUrl: string | null; avatarSeed: string };

export const characterLinkSelect = { id: true, name: true, avatarMediaId: true, avatarSeed: true } as const;
export function toCharacterLink(c: { id: string; name: string; avatarMediaId: string | null; avatarSeed: string }): CharacterLink {
  return { id: c.id, name: c.name, avatarUrl: c.avatarMediaId ? `/api/media/${c.avatarMediaId}` : null, avatarSeed: c.avatarSeed || c.id };
}

export function mediaUrl(id: string | null | undefined) {
  return id ? `/api/media/${id}` : null;
}

export function truncate(s: string, n: number) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`;
}

/** Picks a usable title: the user's, else the model's unless it's a placeholder, else the first words of the premise. */
export function pickTitle(userTitle: string | undefined, modelTitle: string | undefined, premise: string): string {
  const u = userTitle?.trim();
  if (u) return u.slice(0, 120);
  const m = modelTitle?.trim();
  if (m && !/^untitled/i.test(m)) return m.slice(0, 120);
  const words = premise.replace(/[^\p{L}\p{N}'\s-]/gu, " ").split(/\s+/).filter(Boolean).slice(0, 6);
  const t = words.join(" ");
  return (t ? t[0].toUpperCase() + t.slice(1) : "Untitled").slice(0, 120);
}

/* ------------------------------------------------------------------ */
/* Viewer preferences and public-feed filters                          */
/* ------------------------------------------------------------------ */

export function prefsOf(user: { prefsEnc: string | null } | null): UserPrefs {
  return migratePrefs(decryptJson<Partial<UserPrefs> | null>(user?.prefsEnc, null) ?? defaultPrefs());
}

export type ViewerFilters = {
  viewerId: string | null;
  isMod: boolean;
  prefs: UserPrefs;
  blockedIds: string[];
  hiddenTags: string[];
  maxIntensity: number;
};

export async function viewerFilters(user: SafeUser | null): Promise<ViewerFilters> {
  const prefs = prefsOf(user);
  let blockedIds: string[] = [];
  let hiddenTags: string[] = [];
  if (user) {
    const [blocks, hidden] = await Promise.all([
      prisma.block.findMany({ where: { userId: user.id }, select: { blockedUserId: true } }),
      prisma.hiddenTag.findMany({ where: { userId: user.id }, select: { tag: true } }),
    ]);
    blockedIds = blocks.map((b) => b.blockedUserId);
    hiddenTags = Array.from(new Set([...hidden.map((h) => h.tag), ...prefs.excludedThemes]));
  }
  return { viewerId: user?.id ?? null, isMod: isModerator(user), prefs, blockedIds, hiddenTags, maxIntensity: prefs.maxIntensity };
}

function basePublicWhere(f: ViewerFilters, ownerField: "authorId" | "ownerId", maxIntensity?: number) {
  const and: Record<string, unknown>[] = [
    { visibility: "PUBLIC", status: "PUBLISHED", modStatus: "ACTIVE", intensity: { lte: Math.min(f.maxIntensity, maxIntensity ?? 3) } },
  ];
  if (f.blockedIds.length) and.push({ [ownerField]: { notIn: f.blockedIds } });
  for (const t of f.hiddenTags) and.push({ NOT: { tags: { contains: `"${t.replace(/"/g, "")}"` } } });
  return { AND: and };
}

/** Public feed filter: PUBLIC + PUBLISHED + ACTIVE, minus blocked authors, capped by the viewer's max intensity, minus hidden tags. */
export function publicComicWhere(f: ViewerFilters, maxIntensity?: number): Prisma.ComicWhereInput {
  return basePublicWhere(f, "authorId", maxIntensity) as unknown as Prisma.ComicWhereInput;
}
export function publicStoryWhere(f: ViewerFilters, maxIntensity?: number): Prisma.StoryWhereInput {
  return basePublicWhere(f, "authorId", maxIntensity) as unknown as Prisma.StoryWhereInput;
}
export function publicImageWhere(f: ViewerFilters, maxIntensity?: number): Prisma.GeneratedImageWhereInput {
  return basePublicWhere(f, "ownerId", maxIntensity) as unknown as Prisma.GeneratedImageWhereInput;
}

/** Tag/text filter helpers for JSON-array `tags` columns. */
export function tagsContainAll(tags: string[]): Record<string, unknown>[] {
  return tags.filter(Boolean).map((t) => ({ tags: { contains: `"${t.replace(/"/g, "")}"` } }));
}

/* ------------------------------------------------------------------ */
/* Access control for detail pages                                     */
/* ------------------------------------------------------------------ */

export type ContentRow = { ownerId: string; visibility: string; status: string; modStatus: string };
export type ContentAccess = "ok" | "review" | "notfound";

/** Owner and moderators always see everything. Others only see PUBLISHED non-private content; HIDDEN shows an "under review" state. */
export function contentAccess(row: ContentRow, user: SafeUser | null): ContentAccess {
  if (user && (row.ownerId === user.id || isModerator(user))) return "ok";
  if (row.modStatus === "REMOVED") return "notfound";
  if (row.status !== "PUBLISHED" || row.visibility === "PRIVATE") return "notfound";
  if (row.modStatus === "HIDDEN") return "review";
  return "ok";
}

export function isOwnerOrMod(row: { ownerId: string }, user: SafeUser | null) {
  return !!user && (row.ownerId === user.id || isModerator(user));
}

/** Locate any content row by type for the shared reaction/favorite endpoints. */
export async function findContent(type: ContentType, id: string): Promise<(ContentRow & { id: string }) | null> {
  if (type === "comic") {
    const c = await prisma.comic.findUnique({ where: { id }, select: { id: true, authorId: true, visibility: true, status: true, modStatus: true } });
    return c ? { id: c.id, ownerId: c.authorId, visibility: c.visibility, status: c.status, modStatus: c.modStatus } : null;
  }
  if (type === "story") {
    const s = await prisma.story.findUnique({ where: { id }, select: { id: true, authorId: true, visibility: true, status: true, modStatus: true } });
    return s ? { id: s.id, ownerId: s.authorId, visibility: s.visibility, status: s.status, modStatus: s.modStatus } : null;
  }
  const g = await prisma.generatedImage.findUnique({ where: { id }, select: { id: true, ownerId: true, visibility: true, status: true, modStatus: true } });
  return g ? { id: g.id, ownerId: g.ownerId, visibility: g.visibility, status: g.status, modStatus: g.modStatus } : null;
}

/** Fire-and-forget view counter. */
export function bumpViewCount(type: ContentType, id: string) {
  const p =
    type === "comic"
      ? prisma.comic.update({ where: { id }, data: { viewCount: { increment: 1 } } })
      : type === "story"
        ? prisma.story.update({ where: { id }, data: { viewCount: { increment: 1 } } })
        : prisma.generatedImage.update({ where: { id }, data: { viewCount: { increment: 1 } } });
  void p.catch(() => {});
}

/* ------------------------------------------------------------------ */
/* Reactions & favorites                                               */
/* ------------------------------------------------------------------ */

async function adjustCounts(type: ContentType, id: string, delta: { like?: number; favorite?: number }) {
  const like = delta.like ? { likeCount: { increment: delta.like } } : {};
  if (type === "comic") await prisma.comic.update({ where: { id }, data: { ...like, ...(delta.favorite ? { favoriteCount: { increment: delta.favorite } } : {}) } }).catch(() => {});
  else if (type === "story") await prisma.story.update({ where: { id }, data: { ...like, ...(delta.favorite ? { favoriteCount: { increment: delta.favorite } } : {}) } }).catch(() => {});
  else await prisma.generatedImage.update({ where: { id }, data: { ...like, ...(delta.favorite ? { saveCount: { increment: delta.favorite } } : {}) } }).catch(() => {});
}

export async function setContentFavorite(type: ContentType, id: string, userId: string, on: boolean) {
  const targetType = CONTENT_TARGET[type];
  const key = { userId_targetType_targetId: { userId, targetType, targetId: id } };
  const existing = await prisma.contentFavorite.findUnique({ where: key });
  if (on && !existing) {
    await prisma.contentFavorite.create({ data: { userId, targetType, targetId: id } });
    await adjustCounts(type, id, { favorite: 1 });
  } else if (!on && existing) {
    await prisma.contentFavorite.delete({ where: key });
    await adjustCounts(type, id, { favorite: -1 });
  }
  return on;
}

/** Sets (or clears with `kind = null`) the viewer's single reaction. `likeCount` counts reactions of any kind. */
export async function setContentReaction(type: ContentType, id: string, userId: string, kind: ReactionKind | null) {
  const targetType = CONTENT_TARGET[type];
  const key = { userId_targetType_targetId: { userId, targetType, targetId: id } };
  const existing = await prisma.reaction.findUnique({ where: key });
  if (kind) {
    if (!existing) {
      await prisma.reaction.create({ data: { userId, targetType, targetId: id, kind } });
      await adjustCounts(type, id, { like: 1 });
    } else if (existing.kind !== kind) {
      await prisma.reaction.update({ where: key, data: { kind } });
    }
  } else if (existing) {
    await prisma.reaction.delete({ where: key });
    await adjustCounts(type, id, { like: -1 });
  }
  return kind;
}

export type ViewerMarks = { favorites: Set<string>; reactions: Map<string, string> };

export async function viewerContentMarks(viewerId: string | null, type: ContentType, ids: string[]): Promise<ViewerMarks> {
  if (!viewerId || ids.length === 0) return { favorites: new Set(), reactions: new Map() };
  const targetType = CONTENT_TARGET[type];
  const [favs, reacts] = await Promise.all([
    prisma.contentFavorite.findMany({ where: { userId: viewerId, targetType, targetId: { in: ids } }, select: { targetId: true } }),
    prisma.reaction.findMany({ where: { userId: viewerId, targetType, targetId: { in: ids } }, select: { targetId: true, kind: true } }),
  ]);
  return { favorites: new Set(favs.map((f) => f.targetId)), reactions: new Map(reacts.map((r) => [r.targetId, r.kind])) };
}

export async function reactionBreakdown(type: ContentType, id: string): Promise<Record<string, number>> {
  const rows = await prisma.reaction.groupBy({ by: ["kind"], where: { targetType: CONTENT_TARGET[type], targetId: id }, _count: { _all: true } });
  const out: Record<string, number> = {};
  for (const r of rows) out[r.kind] = r._count._all;
  return out;
}

export async function isFollowing(viewerId: string | null, creatorId: string) {
  if (!viewerId || viewerId === creatorId) return false;
  const f = await prisma.follow.findUnique({ where: { followerId_creatorId: { followerId: viewerId, creatorId } } });
  return !!f;
}

/* ------------------------------------------------------------------ */
/* Publishing                                                          */
/* ------------------------------------------------------------------ */

export async function setMediaVisibility(mediaIds: (string | null | undefined)[], visibility: "PUBLIC" | "PRIVATE") {
  const ids = mediaIds.filter((x): x is string => !!x);
  if (ids.length === 0) return;
  await prisma.media.updateMany({ where: { id: { in: ids } }, data: { visibility } });
}

export function publishData(publish: boolean) {
  return publish ? { status: "PUBLISHED", visibility: "PUBLIC", publishedAt: new Date() } : { status: "DRAFT", visibility: "PRIVATE", publishedAt: null };
}

/* ------------------------------------------------------------------ */
/* Sorting & pagination                                                */
/* ------------------------------------------------------------------ */

export type OrderBy = Record<string, "asc" | "desc">[];

/** Stable orderBy for a sort, always ending in `{ id: "desc" }`. `saveField` is `favoriteCount` or `saveCount`. */
export function contentOrderBy(sort: ContentSort, saveField: "favoriteCount" | "saveCount" = "favoriteCount"): OrderBy {
  switch (sort) {
    case "newest":
      return [{ publishedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }];
    case "oldest":
      return [{ publishedAt: "asc" }, { createdAt: "asc" }, { id: "desc" }];
    case "popular":
    case "most_liked":
      return [{ likeCount: "desc" }, { viewCount: "desc" }, { id: "desc" }];
    case "most_saved":
      return [{ [saveField]: "desc" }, { likeCount: "desc" }, { id: "desc" }];
    case "trending":
      return [{ viewCount: "desc" }, { likeCount: "desc" }, { id: "desc" }];
    case "recommended":
    default:
      return [{ [saveField]: "desc" }, { likeCount: "desc" }, { viewCount: "desc" }, { id: "desc" }];
  }
}

export function trendingSince() {
  return new Date(Date.now() - 30 * 24 * 3600 * 1000);
}

/** Deterministic shuffled paging for `sort=random`: shuffle the candidate ids with a client-provided seed and page through them. */
export function randomSlice(ids: string[], seed: number, cursor: string | undefined, limit: number): { ids: string[]; nextCursor: string | null } {
  const rng = mulberry32(seed || 1);
  const arr = [...ids];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const start = cursor ? arr.indexOf(cursor) + 1 : 0;
  const page = arr.slice(start, start + limit);
  const nextCursor = start + limit < arr.length && page.length ? page[page.length - 1] : null;
  return { ids: page, nextCursor };
}

export function orderByIds<T extends { id: string }>(rows: T[], ids: string[]): T[] {
  const map = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => map.get(id)).filter((x): x is T => !!x);
}

/* ------------------------------------------------------------------ */
/* Generation bookkeeping                                              */
/* ------------------------------------------------------------------ */

export type GenerationKind = "CHAT" | "STORY" | "COMIC" | "IMAGE" | "PREVIEW";

/** Times a model call and records a `Generation` row, including failures. */
export async function trackGeneration<T extends { provider: string; model: string; usage?: TextUsage }>(
  userId: string,
  kind: GenerationKind,
  fallback: { provider: string; model: string },
  run: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    const r = await run();
    await prisma.generation
      .create({ data: { userId, kind, provider: r.provider, model: r.model, promptTokens: r.usage?.promptTokens ?? 0, completionTokens: r.usage?.completionTokens ?? 0, durationMs: Date.now() - start, status: "OK" } })
      .catch(() => {});
    return r;
  } catch (err) {
    const blocked = err instanceof ApiError && err.status === 422;
    await prisma.generation
      .create({ data: { userId, kind, provider: fallback.provider, model: fallback.model, durationMs: Date.now() - start, status: blocked ? "BLOCKED" : "ERROR", error: (err instanceof Error ? err.message : String(err)).slice(0, 500) } })
      .catch(() => {});
    throw err;
  }
}

/** Parse model JSON tolerating code fences and prose around the object. */
export function parseJsonLoose<T>(text: string): T | null {
  const attempts: string[] = [text];
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) attempts.push(fence[1]);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) attempts.push(text.slice(start, end + 1));
  for (const a of attempts) {
    try {
      const v = JSON.parse(a);
      if (v && typeof v === "object") return v as T;
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Prisma `Int` is 32-bit signed; keep seeds inside it. */
export function seed31(n: number) {
  return Math.abs(n | 0) % 2147483647;
}

/* ------------------------------------------------------------------ */
/* Characters & chats used by generators                               */
/* ------------------------------------------------------------------ */

export type PickableCharacter = CharacterLink & { intensity: number; tagline: string };

/** Characters a user can feature: their own, favorites, ones they've chatted with, topped up with popular public ones. */
export async function pickableCharacters(userId: string, limit = 40): Promise<PickableCharacter[]> {
  const [own, favs, chats, popular] = await Promise.all([
    prisma.character.findMany({ where: { ownerId: userId }, orderBy: { updatedAt: "desc" }, take: limit }),
    prisma.favorite.findMany({ where: { userId }, include: { character: true }, orderBy: { createdAt: "desc" }, take: limit }),
    prisma.chat.findMany({ where: { userId, isPreview: false }, include: { character: true }, orderBy: { lastMessageAt: "desc" }, take: limit, distinct: ["characterId"] }),
    prisma.character.findMany({ where: { visibility: "PUBLIC", status: "ACTIVE", ageConfirmed: true }, orderBy: [{ chatCount: "desc" }, { id: "desc" }], take: 12 }),
  ]);
  const seen = new Set<string>();
  const out: PickableCharacter[] = [];
  for (const c of [...own, ...chats.map((x) => x.character), ...favs.map((x) => x.character), ...popular]) {
    if (seen.has(c.id) || !canView(c, userId)) continue;
    seen.add(c.id);
    out.push({ ...toCharacterLink(c), intensity: c.intensity, tagline: c.tagline });
    if (out.length >= limit) break;
  }
  return out;
}

export type RecentChat = { id: string; title: string; messageCount: number; lastMessageAt: string; character: CharacterLink };

export async function recentChats(userId: string, limit = 20): Promise<RecentChat[]> {
  const chats = await prisma.chat.findMany({ where: { userId, isPreview: false, archived: false, messageCount: { gt: 0 } }, orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }], take: limit, include: { character: { select: characterLinkSelect } } });
  return chats.map((c) => ({ id: c.id, title: c.title || `Chat with ${c.character.name}`, messageCount: c.messageCount, lastMessageAt: c.lastMessageAt.toISOString(), character: toCharacterLink(c.character) }));
}

export type PromptCharacterBrief = { id: string; name: string; description: string; appearance: string; personality: string; tags: string[]; memories: string[] };

/** Loads the characters a viewer may feature, with the sheet fields prompts need. Unknown or forbidden ids are skipped. */
export async function loadFeaturedCharacters(ids: string[], user: SafeUser): Promise<PromptCharacterBrief[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.character.findMany({ where: { id: { in: ids } } });
  const isMod = isModerator(user);
  return rows
    .filter((c) => canView(c, user.id, isMod))
    .map((c) => {
      const sheet = getSheet(c);
      return { id: c.id, name: c.name, description: c.description, appearance: c.appearance, personality: sheet.personality, tags: parseJsonArray(c.tags), memories: sheet.memories };
    });
}

/** Loads the latest rolling summary the user has with a character, for continuity. */
export async function latestChatSummary(userId: string, characterId: string): Promise<string | null> {
  const chat = await prisma.chat.findFirst({ where: { userId, characterId, summaryEnc: { not: null } }, orderBy: { lastMessageAt: "desc" }, select: { summaryEnc: true } });
  if (!chat?.summaryEnc) return null;
  try {
    return decryptString(chat.summaryEnc);
  } catch {
    return null;
  }
}

export type ChatTranscript = { chat: { id: string; characterId: string }; character: { id: string; name: string }; lines: { role: string; content: string }[]; summary: string | null };

/** Loads the last `limit` messages of the caller's own chat. Throws 404 for anyone else's chat. */
export async function loadOwnChatTranscript(chatId: string, userId: string, limit = 20): Promise<ChatTranscript> {
  const chat = await prisma.chat.findUnique({ where: { id: chatId }, include: { character: { select: { id: true, name: true } }, messages: { orderBy: { createdAt: "desc" }, take: limit } } });
  if (!chat || chat.userId !== userId) throw new ApiError(404, "Chat not found");
  const lines = chat.messages
    .reverse()
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      let content = "";
      try {
        content = decryptString(m.contentEnc);
      } catch {
        content = "";
      }
      return { role: m.role, content };
    })
    .filter((m) => m.content);
  let summary: string | null = null;
  if (chat.summaryEnc) {
    try {
      summary = decryptString(chat.summaryEnc);
    } catch {
      summary = null;
    }
  }
  return { chat: { id: chat.id, characterId: chat.characterId }, character: chat.character, lines, summary };
}

/** Summarizes a chat transcript into a premise via the text provider (recorded as a Generation). */
export async function premiseFromChat(userId: string, kind: "STORY" | "COMIC", t: ChatTranscript): Promise<string> {
  if (t.lines.length === 0) return t.summary ? `Continuing from a chat with ${t.character.name}: ${t.summary}` : `A scene with ${t.character.name}.`;
  const text = getTextProvider();
  const transcript = t.lines.map((l) => `${l.role === "user" ? "User" : t.character.name}: ${l.content}`).join("\n");
  const out = await trackGeneration(userId, kind, { provider: text.name, model: text.model }, () =>
    text.complete({ system: buildSummaryPrompt(), messages: [{ role: "user", content: transcript.slice(-6000) }], meta: { kind: "summary", characterName: t.character.name }, maxTokens: 400 }),
  );
  const summary = out.text.trim() || t.summary || truncate(transcript, 600);
  return `Continuing from a chat with ${t.character.name}. ${summary}`;
}
