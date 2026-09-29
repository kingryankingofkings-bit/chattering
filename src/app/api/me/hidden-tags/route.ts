import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { checkFields } from "@/lib/safety";

/** GET /api/me/hidden-tags → { tags: string[] } */
export const GET = route({ policy: "read" }, async ({ user }) => {
  const rows = await prisma.hiddenTag.findMany({ where: { userId: user!.id }, orderBy: { tag: "asc" } });
  return json({ tags: rows.map((r) => r.tag) });
});

/** PUT /api/me/hidden-tags { tags: string[] } → { tags } (replaces the whole list). */
export const PUT = route({ policy: "write" }, async ({ req, user }) => {
  const { tags } = await parseBody(req, z.object({ tags: z.array(z.string().trim().min(1).max(40)).max(100) }));
  const unique = Array.from(new Set(tags.map((t) => t.toLowerCase())));
  const s = checkFields({ tags: unique });
  if (!s.ok) throw new ApiError(422, s.reason, { category: s.category, field: "tags" });
  await prisma.$transaction([
    prisma.hiddenTag.deleteMany({ where: { userId: user!.id } }),
    ...(unique.length ? [prisma.hiddenTag.createMany({ data: unique.map((tag) => ({ userId: user!.id, tag })) })] : []),
  ]);
  return json({ tags: unique });
});
