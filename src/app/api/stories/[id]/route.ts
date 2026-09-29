import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { ENDINGS, GENRES } from "@/lib/constants";
import { checkFields } from "@/lib/safety";
import { contentAccess } from "@/lib/content";
import { requireOwnedStory, storyInclude, toStoryDetail } from "@/lib/stories";

export const GET = route<{ id: string }>({ policy: "read" }, async ({ user, params }) => {
  const s = await prisma.story.findUnique({ where: { id: params.id }, include: storyInclude });
  if (!s) throw new ApiError(404, "Story not found");
  const access = contentAccess({ ownerId: s.authorId, visibility: s.visibility, status: s.status, modStatus: s.modStatus }, user);
  if (access === "notfound") throw new ApiError(404, "Story not found");
  if (access === "review") throw new ApiError(403, "This story is under review");
  return json(await toStoryDetail(s, user));
});

const update = z.object({
  title: z.string().min(1).max(120).optional(),
  summary: z.string().max(300).optional(),
  genre: z.enum(GENRES).optional(),
  tone: z.string().min(1).max(40).optional(),
  endingType: z.enum(ENDINGS).optional(),
  tags: z.array(z.string().min(1).max(30)).max(12).optional(),
  intensity: z.number().int().min(1).max(3).optional(),
});

export const PUT = route<{ id: string }>({ policy: "write" }, async ({ req, user, params }) => {
  const body = await parseBody(req, update);
  const safety = checkFields({ title: body.title, summary: body.summary, tone: body.tone, tags: body.tags });
  if (!safety.ok) throw new ApiError(422, safety.reason, { category: safety.category, field: safety.field });
  await requireOwnedStory(params.id, user!);
  const s = await prisma.story.update({
    where: { id: params.id },
    data: {
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.summary !== undefined ? { summary: body.summary.trim() } : {}),
      ...(body.genre ? { genre: body.genre } : {}),
      ...(body.tone ? { tone: body.tone } : {}),
      ...(body.endingType ? { endingType: body.endingType } : {}),
      ...(body.tags ? { tags: JSON.stringify(body.tags) } : {}),
      ...(body.intensity ? { intensity: body.intensity } : {}),
    },
    include: storyInclude,
  });
  return json(await toStoryDetail(s, user));
});

export const DELETE = route<{ id: string }>({ policy: "write" }, async ({ user, params }) => {
  const s = await requireOwnedStory(params.id, user!);
  await prisma.story.delete({ where: { id: s.id } });
  await prisma.contentFavorite.deleteMany({ where: { targetType: "STORY", targetId: s.id } });
  await prisma.reaction.deleteMany({ where: { targetType: "STORY", targetId: s.id } });
  return json({ ok: true });
});
