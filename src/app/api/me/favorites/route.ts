import { prisma } from "@/lib/db";
import { json, pagination, parseQuery, route } from "@/lib/api";
import { cardInclude, toCard, viewerMarks } from "@/lib/characters";

/** GET /api/me/favorites?cursor&limit → { items: CharacterCard[], nextCursor } (newest favorite first; cursor = character id). */
export const GET = route({ policy: "read" }, async ({ req, user }) => {
  const q = parseQuery(req, pagination);
  const favs = await prisma.favorite.findMany({
    where: { userId: user!.id, character: { OR: [{ ownerId: user!.id }, { status: "ACTIVE" }] } },
    orderBy: [{ createdAt: "desc" }, { characterId: "desc" }],
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { userId_characterId: { userId: user!.id, characterId: q.cursor } }, skip: 1 } : {}),
    include: { character: { include: cardInclude } },
  });
  const hasMore = favs.length > q.limit;
  const page = favs.slice(0, q.limit);
  const marks = await viewerMarks(user!.id, page.map((f) => f.characterId));
  const items = page.map((f) => toCard(f.character, { id: user!.id, favorites: marks.favorites, ratings: marks.ratings }));
  return json({ items, nextCursor: hasMore ? page[page.length - 1].characterId : null });
});
