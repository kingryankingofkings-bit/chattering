import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { checkFields } from "@/lib/safety";
import { deleteMediaFile } from "@/lib/storage";
import { contentAccess } from "@/lib/content";
import { comicInclude, getPages, pagesMediaIds, requireOwnedComic, toComicDetail } from "@/lib/comics";

export const GET = route<{ id: string }>({ policy: "read" }, async ({ user, params }) => {
  const c = await prisma.comic.findUnique({ where: { id: params.id }, include: comicInclude });
  if (!c) throw new ApiError(404, "Comic not found");
  const access = contentAccess({ ownerId: c.authorId, visibility: c.visibility, status: c.status, modStatus: c.modStatus }, user);
  if (access === "notfound") throw new ApiError(404, "Comic not found");
  if (access === "review") throw new ApiError(403, "This comic is under review");
  return json(await toComicDetail(c, user));
});

const update = z.object({
  title: z.string().min(1).max(120).optional(),
  premise: z.string().max(2000).optional(),
  tags: z.array(z.string().min(1).max(30)).max(12).optional(),
  intensity: z.number().int().min(1).max(3).optional(),
});

export const PUT = route<{ id: string }>({ policy: "write" }, async ({ req, user, params }) => {
  const body = await parseBody(req, update);
  const safety = checkFields({ title: body.title, premise: body.premise, tags: body.tags });
  if (!safety.ok) throw new ApiError(422, safety.reason, { category: safety.category, field: safety.field });
  await requireOwnedComic(params.id, user!);
  const c = await prisma.comic.update({
    where: { id: params.id },
    data: { ...(body.title !== undefined ? { title: body.title.trim() } : {}), ...(body.premise !== undefined ? { premise: body.premise.trim() } : {}), ...(body.tags ? { tags: JSON.stringify(body.tags) } : {}), ...(body.intensity ? { intensity: body.intensity } : {}) },
    include: comicInclude,
  });
  return json(await toComicDetail(c, user));
});

export const DELETE = route<{ id: string }>({ policy: "write" }, async ({ user, params }) => {
  const c = await requireOwnedComic(params.id, user!);
  const mediaIds = pagesMediaIds(getPages(c));
  await prisma.comic.delete({ where: { id: c.id } });
  const media = await prisma.media.findMany({ where: { id: { in: mediaIds }, ownerId: user!.id } });
  await prisma.media.deleteMany({ where: { id: { in: media.map((m) => m.id) } } });
  for (const m of media) await deleteMediaFile(m.storageKey);
  await prisma.contentFavorite.deleteMany({ where: { targetType: "COMIC", targetId: c.id } });
  await prisma.reaction.deleteMany({ where: { targetType: "COMIC", targetId: c.id } });
  return json({ ok: true });
});
