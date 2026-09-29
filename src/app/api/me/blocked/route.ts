import { prisma } from "@/lib/db";
import { json, route } from "@/lib/api";

/** GET /api/me/blocked → { items: { id, displayName, blockedAt }[] } */
export const GET = route({ policy: "read" }, async ({ user }) => {
  const rows = await prisma.block.findMany({ where: { userId: user!.id }, orderBy: { createdAt: "desc" }, include: { blocked: { select: { id: true, displayName: true } } } });
  return json({ items: rows.map((r) => ({ id: r.blocked.id, displayName: r.blocked.displayName, blockedAt: r.createdAt.toISOString() })) });
});
