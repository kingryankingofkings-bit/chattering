import { prisma } from "@/lib/db";
import { ApiError, json, route } from "@/lib/api";
import { canView } from "@/lib/characters";

export const POST = route<{ id: string }>({ policy: "write" }, async ({ user, params }) => {
  const c = await prisma.character.findUnique({ where: { id: params.id } });
  if (!c || !canView(c, user!.id)) throw new ApiError(404, "Character not found");
  const exists = await prisma.favorite.findUnique({ where: { userId_characterId: { userId: user!.id, characterId: c.id } } });
  if (!exists) {
    await prisma.$transaction([
      prisma.favorite.create({ data: { userId: user!.id, characterId: c.id } }),
      prisma.character.update({ where: { id: c.id }, data: { favoriteCount: { increment: 1 } } }),
    ]);
  }
  return json({ ok: true, favorite: true });
});

export const DELETE = route<{ id: string }>({ policy: "write" }, async ({ user, params }) => {
  const r = await prisma.favorite.deleteMany({ where: { userId: user!.id, characterId: params.id } });
  if (r.count > 0) await prisma.character.update({ where: { id: params.id }, data: { favoriteCount: { decrement: 1 } } }).catch(() => {});
  return json({ ok: true, favorite: false });
});
