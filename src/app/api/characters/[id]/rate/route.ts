import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { canView } from "@/lib/characters";

export const POST = route<{ id: string }>({ policy: "write" }, async ({ req, user, params }) => {
  const { score } = await parseBody(req, z.object({ score: z.number().int().min(1).max(5) }));
  const c = await prisma.character.findUnique({ where: { id: params.id } });
  if (!c || !canView(c, user!.id)) throw new ApiError(404, "Character not found");
  if (c.ownerId === user!.id) throw new ApiError(400, "You can't rate your own character");
  const prev = await prisma.rating.findUnique({ where: { userId_characterId: { userId: user!.id, characterId: c.id } } });
  await prisma.$transaction([
    prisma.rating.upsert({ where: { userId_characterId: { userId: user!.id, characterId: c.id } }, create: { userId: user!.id, characterId: c.id, score }, update: { score } }),
    prisma.character.update({ where: { id: c.id }, data: prev ? { ratingSum: { increment: score - prev.score } } : { ratingSum: { increment: score }, ratingCount: { increment: 1 } } }),
  ]);
  const updated = await prisma.character.findUnique({ where: { id: c.id }, select: { ratingSum: true, ratingCount: true } });
  return json({ ok: true, score, rating: updated && updated.ratingCount ? updated.ratingSum / updated.ratingCount : null, ratingCount: updated?.ratingCount ?? 0 });
});
