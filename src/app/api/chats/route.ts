import { z } from "zod";
import { prisma } from "@/lib/db";
import { json, pagination, parseBody, parseQuery, route } from "@/lib/api";
import { createChat } from "@/lib/chat";
import { isModerator } from "@/lib/auth";

const contextSchema = z
  .object({
    version: z.number().default(1),
    scenarioTitle: z.string().max(120).optional(),
    setting: z.string().max(1000).optional(),
    hook: z.string().max(2000).optional(),
    intensity: z.number().int().min(1).max(3).optional(),
    hardLimits: z.string().max(1000).optional(),
    origin: z.enum(["explore", "encounter", "preview", "story", "comic"]).optional(),
  })
  .optional()
  .nullable();

export const POST = route({ policy: "write" }, async ({ req, user }) => {
  const body = await parseBody(req, z.object({ characterId: z.string().min(1), personaId: z.string().optional().nullable(), context: contextSchema, preview: z.boolean().optional() }));
  const chat = await createChat({ userId: user!.id, characterId: body.characterId, personaId: body.personaId, context: body.context ?? null, preview: body.preview, isMod: isModerator(user) });
  return json({ id: chat.id });
});

export const GET = route({ policy: "read" }, async ({ req, user }) => {
  const q = parseQuery(req, pagination.extend({ characterId: z.string().optional(), includePreview: z.coerce.boolean().optional(), archived: z.coerce.boolean().optional() }));
  const chats = await prisma.chat.findMany({
    where: { userId: user!.id, ...(q.characterId ? { characterId: q.characterId } : {}), ...(q.includePreview ? {} : { isPreview: false }), archived: q.archived ?? false },
    orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    include: { character: { select: { id: true, name: true, avatarMediaId: true, avatarSeed: true, intensity: true } } },
  });
  const hasMore = chats.length > q.limit;
  const items = chats.slice(0, q.limit).map((c) => ({
    id: c.id,
    title: c.title,
    characterId: c.characterId,
    character: { id: c.character.id, name: c.character.name, avatarUrl: c.character.avatarMediaId ? `/api/media/${c.character.avatarMediaId}` : null, avatarSeed: c.character.avatarSeed || c.character.id, intensity: c.character.intensity },
    lastMessageAt: c.lastMessageAt.toISOString(),
    messageCount: c.messageCount,
    isPreview: c.isPreview,
    archived: c.archived,
  }));
  return json({ items, nextCursor: hasMore ? items[items.length - 1].id : null });
});
