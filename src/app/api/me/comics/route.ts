import { z } from "zod";
import { prisma } from "@/lib/db";
import { json, pagination, parseQuery, route } from "@/lib/api";
import { toComicItem, visibleContentWhere } from "@/lib/blackbook";

/** GET /api/me/comics?cursor&limit[&favorites=1] → { items: ComicItem[], nextCursor } */
export const GET = route({ policy: "read" }, async ({ req, user }) => {
  const q = parseQuery(req, pagination.extend({ favorites: z.string().optional() }));
  if (q.favorites === "1") {
    const favs = await prisma.contentFavorite.findMany({
      where: { userId: user!.id, targetType: "COMIC" },
      orderBy: [{ createdAt: "desc" }, { targetId: "desc" }],
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { userId_targetType_targetId: { userId: user!.id, targetType: "COMIC", targetId: q.cursor } }, skip: 1 } : {}),
    });
    const hasMore = favs.length > q.limit;
    const page = favs.slice(0, q.limit);
    const rows = await prisma.comic.findMany({ where: { id: { in: page.map((f) => f.targetId) }, ...visibleContentWhere(user!.id) } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const items = page.flatMap((f) => (byId.get(f.targetId) ? [toComicItem(byId.get(f.targetId)!)] : []));
    return json({ items, nextCursor: hasMore ? page[page.length - 1].targetId : null });
  }
  const rows = await prisma.comic.findMany({
    where: { authorId: user!.id },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > q.limit;
  const items = rows.slice(0, q.limit).map(toComicItem);
  return json({ items, nextCursor: hasMore ? items[items.length - 1].id : null });
});
