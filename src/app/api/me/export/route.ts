import { prisma } from "@/lib/db";
import { route } from "@/lib/api";
import { decryptJson, decryptString } from "@/lib/crypto";
import { notificationPrefs, toMe, userPrefs, toEncounterItem } from "@/lib/blackbook";
import { toFull } from "@/lib/character-write";
import { toPersonaDto } from "@/lib/personas";
import type { ComicPage, StoryChapter } from "@/lib/types";

function dec(v: string | null | undefined) {
  if (!v) return null;
  try {
    return decryptString(v);
  } catch {
    return null;
  }
}

/** GET /api/me/export → JSON attachment with everything the user owns, decrypted. */
export const GET = route({ policy: "read" }, async ({ user }) => {
  const uid = user!.id;
  const [personas, characters, chats, favorites, contentFavorites, collections, encounters, stories, comics, images, following, blocks, hiddenTags, pinned] = await Promise.all([
    prisma.persona.findMany({ where: { userId: uid } }),
    prisma.character.findMany({ where: { ownerId: uid } }),
    prisma.chat.findMany({ where: { userId: uid }, include: { messages: { orderBy: { createdAt: "asc" } }, character: { select: { id: true, name: true } } } }),
    prisma.favorite.findMany({ where: { userId: uid }, include: { character: { select: { id: true, name: true } } } }),
    prisma.contentFavorite.findMany({ where: { userId: uid } }),
    prisma.collection.findMany({ where: { userId: uid }, include: { items: { orderBy: { position: "asc" } } } }),
    prisma.savedEncounter.findMany({ where: { userId: uid }, include: { character: { select: { id: true, name: true, avatarMediaId: true, avatarSeed: true } } } }),
    prisma.story.findMany({ where: { authorId: uid } }),
    prisma.comic.findMany({ where: { authorId: uid } }),
    prisma.generatedImage.findMany({ where: { ownerId: uid } }),
    prisma.follow.findMany({ where: { followerId: uid }, include: { creator: { select: { id: true, displayName: true } } } }),
    prisma.block.findMany({ where: { userId: uid }, include: { blocked: { select: { id: true, displayName: true } } } }),
    prisma.hiddenTag.findMany({ where: { userId: uid } }),
    prisma.pinnedCharacter.findMany({ where: { userId: uid }, orderBy: { position: "asc" } }),
  ]);

  const payload = {
    format: "chattering.export",
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: toMe(user!),
    prefs: userPrefs(user!),
    notificationPrefs: notificationPrefs(user!),
    personas: personas.map(toPersonaDto),
    characters: characters.map(toFull),
    chats: chats.map((c) => ({
      id: c.id,
      title: c.title,
      character: c.character,
      personaId: c.personaId,
      context: decryptJson(c.contextEnc, null),
      summary: dec(c.summaryEnc),
      isPreview: c.isPreview,
      archived: c.archived,
      createdAt: c.createdAt,
      lastMessageAt: c.lastMessageAt,
      messages: c.messages.map((m) => ({ id: m.id, role: m.role, content: dec(m.contentEnc) ?? "", model: m.model, createdAt: m.createdAt })),
    })),
    favorites: favorites.map((f) => ({ characterId: f.characterId, name: f.character.name, createdAt: f.createdAt })),
    contentFavorites: contentFavorites.map((f) => ({ targetType: f.targetType, targetId: f.targetId, createdAt: f.createdAt })),
    pinned: pinned.map((p) => p.characterId),
    collections: collections.map((c) => ({ id: c.id, name: c.name, description: c.description, createdAt: c.createdAt, items: c.items.map((i) => ({ targetType: i.targetType, targetId: i.targetId, position: i.position, addedAt: i.addedAt })) })),
    savedEncounters: encounters.map(toEncounterItem),
    stories: stories.map((s) => ({ ...omitEnc(s), chapters: decryptJson<StoryChapter[]>(s.contentEnc, []) })),
    comics: comics.map((c) => ({ ...omitEnc(c), pages: decryptJson<ComicPage[]>(c.pagesEnc, []) })),
    images: images.map((i) => ({ ...omitEnc(i), url: `/api/media/${i.mediaId}`, prompt: dec(i.promptEnc), negativePrompt: dec(i.negativeEnc) })),
    following: following.map((f) => ({ id: f.creator.id, displayName: f.creator.displayName, since: f.createdAt })),
    blocked: blocks.map((b) => ({ id: b.blocked.id, displayName: b.blocked.displayName, since: b.createdAt })),
    hiddenTags: hiddenTags.map((h) => h.tag),
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="chattering-export.json"',
      "cache-control": "no-store",
    },
  });
});

/** Strip every *Enc column so nothing encrypted leaves raw. */
function omitEnc<T extends Record<string, unknown>>(row: T): Omit<T, `${string}Enc`> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (!k.endsWith("Enc")) out[k] = v;
  return out as Omit<T, `${string}Enc`>;
}
