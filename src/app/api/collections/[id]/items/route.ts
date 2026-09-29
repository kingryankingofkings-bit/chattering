import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, parseQuery, route } from "@/lib/api";
import { assertCollectible } from "@/lib/blackbook";

const targetSchema = z.object({ targetType: z.enum(["CHARACTER", "COMIC", "STORY", "IMAGE", "ENCOUNTER"]), targetId: z.string().min(1).max(64) });

async function owned(id: string, userId: string) {
  const c = await prisma.collection.findFirst({ where: { id, userId }, select: { id: true } });
  if (!c) throw new ApiError(404, "Collection not found");
  return c;
}

/** POST /api/collections/[id]/items { targetType, targetId } → { ok, added } (upsert; position = max+1). */
export const POST = route<{ id: string }>({ policy: "write" }, async ({ req, user, params }) => {
  const c = await owned(params.id, user!.id);
  const body = await parseBody(req, targetSchema);
  if (!(await assertCollectible(body.targetType, body.targetId, user!.id))) throw new ApiError(404, "That item isn't available");
  const existing = await prisma.collectionItem.findUnique({ where: { collectionId_targetType_targetId: { collectionId: c.id, ...body } } });
  if (existing) return json({ ok: true, added: false });
  const count = await prisma.collectionItem.count({ where: { collectionId: c.id } });
  if (count >= 500) throw new ApiError(400, "This collection is full (500 items)");
  const max = await prisma.collectionItem.aggregate({ where: { collectionId: c.id }, _max: { position: true } });
  await prisma.$transaction([
    prisma.collectionItem.create({ data: { collectionId: c.id, ...body, position: (max._max.position ?? -1) + 1 } }),
    prisma.collection.update({ where: { id: c.id }, data: { updatedAt: new Date() } }),
  ]);
  return json({ ok: true, added: true }, { status: 201 });
});

/** DELETE /api/collections/[id]/items?targetType=&targetId= → { ok } */
export const DELETE = route<{ id: string }>({ policy: "write" }, async ({ req, user, params }) => {
  const c = await owned(params.id, user!.id);
  const q = parseQuery(req, targetSchema);
  await prisma.collectionItem.deleteMany({ where: { collectionId: c.id, targetType: q.targetType, targetId: q.targetId } });
  return json({ ok: true });
});
