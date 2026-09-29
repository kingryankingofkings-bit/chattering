import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { checkFields } from "@/lib/safety";
import { collectionSchema, resolveCollectionItems } from "@/lib/blackbook";

async function owned(id: string, userId: string) {
  const c = await prisma.collection.findFirst({ where: { id, userId }, include: { items: true } });
  if (!c) throw new ApiError(404, "Collection not found");
  return c;
}

/** GET /api/collections/[id] → { collection, items: CollectionItemDto[] } */
export const GET = route<{ id: string }>({ policy: "read" }, async ({ user, params }) => {
  const c = await owned(params.id, user!.id);
  const items = await resolveCollectionItems(c.items, user!.id);
  return json({ collection: { id: c.id, name: c.name, description: c.description, itemCount: c.items.length, updatedAt: c.updatedAt.toISOString() }, items });
});

/** PUT /api/collections/[id] { name, description? } → { collection } */
export const PUT = route<{ id: string }>({ policy: "write" }, async ({ req, user, params }) => {
  const c = await owned(params.id, user!.id);
  const body = await parseBody(req, collectionSchema);
  const s = checkFields({ name: body.name, description: body.description });
  if (!s.ok) throw new ApiError(422, s.reason, { category: s.category, field: s.field });
  const updated = await prisma.collection.update({ where: { id: c.id }, data: body });
  return json({ collection: { id: updated.id, name: updated.name, description: updated.description, itemCount: c.items.length, updatedAt: updated.updatedAt.toISOString() } });
});

/** DELETE /api/collections/[id] → { ok } */
export const DELETE = route<{ id: string }>({ policy: "write" }, async ({ user, params }) => {
  const c = await owned(params.id, user!.id);
  await prisma.collection.delete({ where: { id: c.id } });
  return json({ ok: true });
});
