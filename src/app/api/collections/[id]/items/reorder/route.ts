import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";

const schema = z.object({ order: z.array(z.object({ targetType: z.string().max(20), targetId: z.string().max(64) })).max(500) });

/** PUT /api/collections/[id]/items/reorder { order: [{targetType,targetId}] } → { ok }. Unlisted items follow, in their previous order. */
export const PUT = route<{ id: string }>({ policy: "write" }, async ({ req, user, params }) => {
  const c = await prisma.collection.findFirst({ where: { id: params.id, userId: user!.id }, include: { items: { orderBy: { position: "asc" } } } });
  if (!c) throw new ApiError(404, "Collection not found");
  const { order } = await parseBody(req, schema);
  const key = (i: { targetType: string; targetId: string }) => `${i.targetType}:${i.targetId}`;
  const known = new Map(c.items.map((i) => [key(i), i]));
  const listed = order.map(key).filter((k) => known.has(k));
  const seq = [...new Set([...listed, ...c.items.map(key)])];
  await prisma.$transaction(
    seq.map((k, position) => {
      const item = known.get(k)!;
      return prisma.collectionItem.update({ where: { collectionId_targetType_targetId: { collectionId: c.id, targetType: item.targetType, targetId: item.targetId } }, data: { position } });
    }),
  );
  return json({ ok: true });
});
