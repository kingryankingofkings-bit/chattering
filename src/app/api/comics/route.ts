import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { json, pagination, parseQuery, route } from "@/lib/api";
import { ART_STYLES } from "@/lib/constants";
import { contentOrderBy, orderByIds, publicComicWhere, randomSlice, tagsContainAll, trendingSince, viewerContentMarks, viewerFilters } from "@/lib/content";
import { comicInclude, comicSearchWhere, toComicCard } from "@/lib/comics";

const query = pagination.extend({
  view: z.enum(["public", "mine", "drafts", "published"]).default("public"),
  q: z.string().max(80).optional(),
  tags: z.string().max(200).optional(),
  style: z.enum(ART_STYLES).optional(),
  maxIntensity: z.coerce.number().int().min(1).max(3).optional(),
  sort: z.enum(["recommended", "trending", "newest", "popular", "random"]).default("recommended"),
  seed: z.coerce.number().int().optional(),
});

export const GET = route({ policy: "read" }, async ({ req, user }) => {
  const q = parseQuery(req, query);
  const f = await viewerFilters(user);
  const and: Prisma.ComicWhereInput[] = [];
  if (q.view === "public") and.push(publicComicWhere(f, q.maxIntensity));
  else {
    and.push({ authorId: user!.id });
    if (q.view === "drafts") and.push({ status: "DRAFT" });
    if (q.view === "published") and.push({ status: "PUBLISHED" });
    if (q.maxIntensity) and.push({ intensity: { lte: q.maxIntensity } });
  }
  const search = comicSearchWhere(q.q);
  if (search) and.push(search);
  if (q.tags) and.push(...(tagsContainAll(q.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8)) as Prisma.ComicWhereInput[]));
  if (q.style) and.push({ artStyle: q.style });
  if (q.sort === "trending" && q.view === "public") and.push({ publishedAt: { gte: trendingSince() } });
  const where: Prisma.ComicWhereInput = { AND: and };

  let items;
  let nextCursor: string | null = null;
  if (q.sort === "random") {
    const ids = (await prisma.comic.findMany({ where, select: { id: true }, take: 500 })).map((x) => x.id);
    const page = randomSlice(ids, q.seed ?? 1, q.cursor, q.limit);
    const rows = await prisma.comic.findMany({ where: { id: { in: page.ids } }, include: comicInclude });
    items = orderByIds(rows, page.ids);
    nextCursor = page.nextCursor;
  } else {
    const orderBy = q.view === "public" ? contentOrderBy(q.sort) : [{ updatedAt: "desc" as const }, { id: "desc" as const }];
    const rows = await prisma.comic.findMany({ where, include: comicInclude, orderBy, take: q.limit + 1, ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}) });
    items = rows.slice(0, q.limit);
    nextCursor = rows.length > q.limit ? items[items.length - 1].id : null;
  }
  const marks = await viewerContentMarks(user!.id, "comic", items.map((c) => c.id));
  return json({ items: items.map((c) => toComicCard(c, user!.id, marks)), nextCursor });
});
