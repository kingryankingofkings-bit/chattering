import { prisma } from "@/lib/db";
import { json, route } from "@/lib/api";

/** GET /api/me/following → { items: { id, displayName, avatarUrl, characterCount, followedAt }[] } */
export const GET = route({ policy: "read" }, async ({ user }) => {
  const rows = await prisma.follow.findMany({
    where: { followerId: user!.id, creator: { deletedAt: null } },
    orderBy: { createdAt: "desc" },
    include: { creator: { select: { id: true, displayName: true, avatarMediaId: true } } },
  });
  const ids = rows.map((r) => r.creatorId);
  const counts = ids.length ? await prisma.character.groupBy({ by: ["ownerId"], where: { ownerId: { in: ids }, visibility: "PUBLIC", status: "ACTIVE" }, _count: { _all: true } }) : [];
  const countBy = new Map(counts.map((c) => [c.ownerId, c._count._all]));
  return json({
    items: rows.map((r) => ({
      id: r.creator.id,
      displayName: r.creator.displayName,
      avatarUrl: r.creator.avatarMediaId ? `/api/media/${r.creator.avatarMediaId}` : null,
      characterCount: countBy.get(r.creatorId) ?? 0,
      followedAt: r.createdAt.toISOString(),
    })),
  });
});
