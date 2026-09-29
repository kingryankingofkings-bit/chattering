import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { checkFields } from "@/lib/safety";
import { collectionSchema, listCollections } from "@/lib/blackbook";

/** GET /api/collections → { items: { id, name, description, itemCount, updatedAt }[] } */
export const GET = route({ policy: "read" }, async ({ user }) => json({ items: await listCollections(user!.id) }));

/** POST /api/collections { name, description? } → { collection } */
export const POST = route({ policy: "write" }, async ({ req, user }) => {
  const body = await parseBody(req, collectionSchema);
  const s = checkFields({ name: body.name, description: body.description });
  if (!s.ok) throw new ApiError(422, s.reason, { category: s.category, field: s.field });
  const count = await prisma.collection.count({ where: { userId: user!.id } });
  if (count >= 100) throw new ApiError(400, "You can keep up to 100 collections");
  const c = await prisma.collection.create({ data: { userId: user!.id, name: body.name, description: body.description } });
  return json({ collection: { id: c.id, name: c.name, description: c.description, itemCount: 0, updatedAt: c.updatedAt.toISOString() } }, { status: 201 });
});
