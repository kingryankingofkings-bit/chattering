import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { encryptJson } from "@/lib/crypto";
import { checkText } from "@/lib/safety";
import { characterSheetLine, comicInclude, drawPanel, getPages, loadComicCharacterBriefs, requireOwnedComic, toComicDetail } from "@/lib/comics";

/** Redraws one panel, optionally with a new image prompt. */
export const POST = route<{ id: string; panelId: string }>({ policy: "image" }, async ({ req, user, params }) => {
  const body = await parseBody(req, z.object({ imagePrompt: z.string().max(800).optional() }));
  if (body.imagePrompt) {
    const r = checkText(body.imagePrompt);
    if (!r.ok) throw new ApiError(422, r.reason, { category: r.category });
  }
  const comic = await requireOwnedComic(params.id, user!);
  const pages = getPages(comic);
  let index = 0;
  let found = false;
  for (const page of pages) {
    for (const panel of page.panels) {
      if (panel.id === params.panelId) {
        found = true;
        const imagePrompt = body.imagePrompt?.trim() || panel.imagePrompt;
        const chars = await loadComicCharacterBriefs(comic.id, user!);
        const drawn = await drawPanel(user!, { imagePrompt, artStyle: comic.artStyle, orientation: comic.orientation, index: index + Math.floor(Math.random() * 1000), characterSheet: characterSheetLine(chars) });
        panel.imagePrompt = imagePrompt;
        panel.mediaId = drawn.mediaId;
        // Media is PRIVATE by default; if the comic is public, expose the new panel too.
        if (comic.visibility === "PUBLIC" && comic.status === "PUBLISHED") await prisma.media.update({ where: { id: drawn.mediaId }, data: { visibility: "PUBLIC" } });
      }
      index++;
    }
  }
  if (!found) throw new ApiError(404, "Panel not found");
  const c = await prisma.comic.update({ where: { id: comic.id }, data: { pagesEnc: encryptJson(pages), coverMediaId: pages[0]?.panels[0]?.mediaId ?? comic.coverMediaId }, include: comicInclude });
  return json(await toComicDetail(c, user));
});
