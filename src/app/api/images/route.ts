import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { json, pagination, parseQuery, route } from "@/lib/api";
import { ART_STYLES, ORIENTATION_OPTS } from "@/lib/constants";
import { contentOrderBy, orderByIds, publicImageWhere, randomSlice, tagsContainAll, viewerContentMarks, viewerFilters } from "@/lib/content";
import { imageInclude, imageSearchWhere, mediaDims, toImageCard } from "@/lib/images";

const query = pagination.extend({
  view: z.enum(["public", "mine", "favorites", "drafts", "published"]).default("public"),
  q: z.string().max(80).optional(),
  characterId: z.string().max(64).optional(),
  character: z.string().max(80).optional(),
  creator: z.string().max(80).optional(),
  tags: z.string().max(200).optional(),
  style: z.enum(ART_STYLES).optional(),
  orientation: z.enum(ORIENTATION_OPTS).optional(),
  range: z.enum(["all", "7d", "30d"]).default("all"),
  minLikes: z.coerce.number().int().min(0).optional(),
  maxIntensity: z.coerce.number().int().min(1).max(3).optional(),
  sort: z.enum(["recommended", "newest", "oldest", "most_liked", "most_saved", "random"]).default("recommended"),
  seed: z.coerce.number().int().optional(),
});

export const GET = route({ policy: "read" }, async ({ req, user }) => {
  const q = parseQuery(req, query);
  const f = await viewerFilters(user);
  const and: Prisma.GeneratedImageWhereInput[] = [];
  if (q.view === "public") and.push(publicImageWhere(f, q.maxIntensity));
  else if (q.view === "favorites") {
    const favs = await prisma.contentFavorite.findMany({ where: { userId: user!.id, targetType: "IMAGE" }, select: { targetId: true } });
    and.push({ id: { in: favs.map((x) => x.targetId) } });
    // Favorites can include other people's images: only show what the viewer may still see.
    and.push({ OR: [{ ownerId: user!.id }, { visibility: "PUBLIC", status: "PUBLISHED", modStatus: "ACTIVE" }] });
    if (q.maxIntensity) and.push({ intensity: { lte: q.maxIntensity } });
  } else {
    and.push({ ownerId: user!.id });
    if (q.view === "drafts") and.push({ status: "DRAFT" });
    if (q.view === "published") and.push({ status: "PUBLISHED" });
    if (q.maxIntensity) and.push({ intensity: { lte: q.maxIntensity } });
  }
  const search = imageSearchWhere(q.q);
  if (search) and.push(search);
  if (q.characterId) and.push({ characterId: q.characterId });
  else if (q.character) and.push({ character: { name: { contains: q.character.trim().slice(0, 60) } } });
  if (q.creator) and.push({ owner: { displayName: { contains: q.creator.trim().slice(0, 60) } } });
  if (q.tags) and.push(...(tagsContainAll(q.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8)) as Prisma.GeneratedImageWhereInput[]));
  if (q.style) and.push({ style: q.style });
  if (q.orientation) and.push({ orientation: q.orientation });
  if (q.range !== "all") and.push({ createdAt: { gte: new Date(Date.now() - (q.range === "7d" ? 7 : 30) * 24 * 3600 * 1000) } });
  if (q.minLikes) and.push({ likeCount: { gte: q.minLikes } });
  const where: Prisma.GeneratedImageWhereInput = { AND: and };

  let items;
  let nextCursor: string | null = null;
  if (q.sort === "random") {
    const ids = (await prisma.generatedImage.findMany({ where, select: { id: true }, take: 800 })).map((x) => x.id);
    const page = randomSlice(ids, q.seed ?? 1, q.cursor, q.limit);
    const rows = await prisma.generatedImage.findMany({ where: { id: { in: page.ids } }, include: imageInclude });
    items = orderByIds(rows, page.ids);
    nextCursor = page.nextCursor;
  } else {
    const orderBy = q.view === "public" || q.sort !== "recommended" ? contentOrderBy(q.sort, "saveCount") : [{ createdAt: "desc" as const }, { id: "desc" as const }];
    const rows = await prisma.generatedImage.findMany({ where, include: imageInclude, orderBy, take: q.limit + 1, ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}) });
    items = rows.slice(0, q.limit);
    nextCursor = rows.length > q.limit ? items[items.length - 1].id : null;
  }
  const [marks, dims] = await Promise.all([viewerContentMarks(user!.id, "image", items.map((g) => g.id)), mediaDims(items.map((g) => g.mediaId))]);
  return json({ items: items.map((g) => toImageCard(g, user!.id, marks, dims)), nextCursor });
});
