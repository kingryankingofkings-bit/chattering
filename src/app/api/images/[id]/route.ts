import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { checkFields } from "@/lib/safety";
import { deleteMediaFile } from "@/lib/storage";
import { contentAccess } from "@/lib/content";
import { imageInclude, requireOwnedImage, toImageDetail } from "@/lib/images";

export const GET = route<{ id: string }>({ policy: "read" }, async ({ user, params }) => {
  const g = await prisma.generatedImage.findUnique({ where: { id: params.id }, include: imageInclude });
  if (!g) throw new ApiError(404, "Image not found");
  const access = contentAccess({ ownerId: g.ownerId, visibility: g.visibility, status: g.status, modStatus: g.modStatus }, user);
  if (access === "notfound") throw new ApiError(404, "Image not found");
  if (access === "review") throw new ApiError(403, "This image is under review");
  return json(await toImageDetail(g, user));
});

const update = z.object({
  title: z.string().max(120).optional(),
  tags: z.array(z.string().min(1).max(30)).max(12).optional(),
  intensity: z.number().int().min(1).max(3).optional(),
  showDetails: z.boolean().optional(),
  allowRemix: z.boolean().optional(),
});

export const PUT = route<{ id: string }>({ policy: "write" }, async ({ req, user, params }) => {
  const body = await parseBody(req, update);
  const safety = checkFields({ title: body.title, tags: body.tags });
  if (!safety.ok) throw new ApiError(422, safety.reason, { category: safety.category, field: safety.field });
  await requireOwnedImage(params.id, user!);
  const g = await prisma.generatedImage.update({
    where: { id: params.id },
    data: {
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.tags ? { tags: JSON.stringify(body.tags) } : {}),
      ...(body.intensity ? { intensity: body.intensity } : {}),
      ...(body.showDetails !== undefined ? { showDetails: body.showDetails } : {}),
      ...(body.allowRemix !== undefined ? { allowRemix: body.allowRemix } : {}),
    },
    include: imageInclude,
  });
  return json(await toImageDetail(g, user));
});

export const DELETE = route<{ id: string }>({ policy: "write" }, async ({ user, params }) => {
  const g = await requireOwnedImage(params.id, user!);
  await prisma.generatedImage.delete({ where: { id: g.id } });
  const media = await prisma.media.findUnique({ where: { id: g.mediaId } });
  if (media && media.ownerId === user!.id) {
    await prisma.media.delete({ where: { id: media.id } }).catch(() => {});
    await deleteMediaFile(media.storageKey);
  }
  await prisma.contentFavorite.deleteMany({ where: { targetType: "IMAGE", targetId: g.id } });
  await prisma.reaction.deleteMany({ where: { targetType: "IMAGE", targetId: g.id } });
  return json({ ok: true });
});
