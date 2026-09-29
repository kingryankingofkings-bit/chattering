import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, parseJsonArray, route } from "@/lib/api";
import { contentAccess, mediaUrl } from "@/lib/content";
import { getPages } from "@/lib/comics";
import { slugify } from "@/lib/utils";

/** JSON attachment of the script plus media URLs. */
export const GET = route<{ id: string }>({ policy: "read" }, async ({ req, user, params }) => {
  const c = await prisma.comic.findUnique({ where: { id: params.id }, include: { author: { select: { id: true, displayName: true } }, characters: { include: { character: { select: { id: true, name: true } } } } } });
  if (!c) throw new ApiError(404, "Comic not found");
  if (contentAccess({ ownerId: c.authorId, visibility: c.visibility, status: c.status, modStatus: c.modStatus }, user) !== "ok") throw new ApiError(404, "Comic not found");
  const origin = req.nextUrl.origin;
  const pages = getPages(c);
  const doc = {
    id: c.id,
    title: c.title,
    premise: c.premise,
    author: c.author.displayName,
    artStyle: c.artStyle,
    panelLayout: c.panelLayout,
    tone: c.tone,
    orientation: c.orientation,
    intensity: c.intensity,
    tags: parseJsonArray(c.tags),
    characters: c.characters.map((l) => l.character.name),
    createdAt: c.createdAt.toISOString(),
    pages: pages.map((p, i) => ({ number: i + 1, id: p.id, panels: p.panels.map((pn) => ({ id: pn.id, caption: pn.caption, dialogue: pn.dialogue, sfx: pn.sfx, imagePrompt: pn.imagePrompt, imageUrl: pn.mediaId ? `${origin}${mediaUrl(pn.mediaId)}` : null })) })),
  };
  return new NextResponse(JSON.stringify(doc, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${slugify(c.title) || "comic"}.json"` },
  });
});
