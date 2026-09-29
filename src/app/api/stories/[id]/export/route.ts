import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, parseJsonArray, parseQuery, route } from "@/lib/api";
import { contentAccess } from "@/lib/content";
import { getChapters, storyToMarkdown } from "@/lib/stories";
import { slugify } from "@/lib/utils";

export const GET = route<{ id: string }>({ policy: "read" }, async ({ req, user, params }) => {
  const q = parseQuery(req, z.object({ format: z.enum(["md", "json"]).default("md") }));
  const s = await prisma.story.findUnique({ where: { id: params.id }, include: { author: { select: { displayName: true } } } });
  if (!s || contentAccess({ ownerId: s.authorId, visibility: s.visibility, status: s.status, modStatus: s.modStatus }, user) !== "ok") throw new ApiError(404, "Story not found");
  const chapters = getChapters(s);
  const name = slugify(s.title) || "story";
  if (q.format === "json") {
    const doc = { id: s.id, title: s.title, summary: s.summary, author: s.author.displayName, genre: s.genre, tone: s.tone, pov: s.pov, tense: s.tense, length: s.length, intensity: s.intensity, endingType: s.endingType, tags: parseJsonArray(s.tags), wordCount: s.wordCount, createdAt: s.createdAt.toISOString(), chapters };
    return new NextResponse(JSON.stringify(doc, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${name}.json"` } });
  }
  return new NextResponse(storyToMarkdown(s, chapters), { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="${name}.md"` } });
});
