import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { json, pagination, parseQuery, route } from "@/lib/api";
import { GENRES, STORY_LENGTHS } from "@/lib/constants";
import { contentOrderBy, orderByIds, publicStoryWhere, randomSlice, tagsContainAll, trendingSince, viewerContentMarks, viewerFilters } from "@/lib/content";
import { storyInclude, storySearchWhere, toStoryCard } from "@/lib/stories";

const query = pagination.extend({
  view: z.enum(["public", "mine", "drafts", "published"]).default("public"),
  q: z.string().max(80).optional(),
  genre: z.enum(GENRES).optional(),
  tags: z.string().max(200).optional(),
  length: z.enum(STORY_LENGTHS).optional(),
  maxIntensity: z.coerce.number().int().min(1).max(3).optional(),
  sort: z.enum(["popular", "newest", "recommended", "trending", "random"]).default("recommended"),
  seed: z.coerce.number().int().optional(),
});

export const GET = route({ policy: "read" }, async ({ req, user }) => {
  const q = parseQuery(req, query);
  const f = await viewerFilters(user);
  const and: Prisma.StoryWhereInput[] = [];
  if (q.view === "public") and.push(publicStoryWhere(f, q.maxIntensity));
  else {
    and.push({ authorId: user!.id });
    if (q.view === "drafts") and.push({ status: "DRAFT" });
    if (q.view === "published") and.push({ status: "PUBLISHED" });
    if (q.maxIntensity) and.push({ intensity: { lte: q.maxIntensity } });
  }
  const search = storySearchWhere(q.q);
  if (search) and.push(search);
  if (q.genre) and.push({ genre: q.genre });
  if (q.length) and.push({ length: q.length });
  if (q.tags) and.push(...(tagsContainAll(q.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8)) as Prisma.StoryWhereInput[]));
  if (q.sort === "trending" && q.view === "public") and.push({ publishedAt: { gte: trendingSince() } });
  const where: Prisma.StoryWhereInput = { AND: and };

  let items;
  let nextCursor: string | null = null;
  if (q.sort === "random") {
    const ids = (await prisma.story.findMany({ where, select: { id: true }, take: 500 })).map((x) => x.id);
    const page = randomSlice(ids, q.seed ?? 1, q.cursor, q.limit);
    const rows = await prisma.story.findMany({ where: { id: { in: page.ids } }, include: storyInclude });
    items = orderByIds(rows, page.ids);
    nextCursor = page.nextCursor;
  } else {
    const orderBy = q.view === "public" ? contentOrderBy(q.sort) : [{ updatedAt: "desc" as const }, { id: "desc" as const }];
    const rows = await prisma.story.findMany({ where, include: storyInclude, orderBy, take: q.limit + 1, ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}) });
    items = rows.slice(0, q.limit);
    nextCursor = rows.length > q.limit ? items[items.length - 1].id : null;
  }
  const marks = await viewerContentMarks(user!.id, "story", items.map((s) => s.id));
  return json({ items: items.map((s) => toStoryCard(s, user!.id, marks)), nextCursor });
});
