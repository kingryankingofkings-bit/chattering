import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { contentAccess } from "@/lib/content";

export const PUT = route<{ id: string }>({ policy: "write" }, async ({ req, user, params }) => {
  const body = await parseBody(req, z.object({ chapterIndex: z.number().int().min(0).max(500), scrollRatio: z.number().min(0).max(1) }));
  const s = await prisma.story.findUnique({ where: { id: params.id }, select: { id: true, authorId: true, visibility: true, status: true, modStatus: true } });
  if (!s || contentAccess({ ownerId: s.authorId, visibility: s.visibility, status: s.status, modStatus: s.modStatus }, user) !== "ok") throw new ApiError(404, "Story not found");
  await prisma.bookmark.upsert({
    where: { userId_storyId: { userId: user!.id, storyId: s.id } },
    create: { userId: user!.id, storyId: s.id, chapterIndex: body.chapterIndex, scrollRatio: body.scrollRatio },
    update: { chapterIndex: body.chapterIndex, scrollRatio: body.scrollRatio },
  });
  return json({ ok: true });
});
