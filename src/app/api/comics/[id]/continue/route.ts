import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { encryptJson } from "@/lib/crypto";
import { checkText } from "@/lib/safety";
import { PANELS_PER_LAYOUT, characterSheetLine, comicInclude, drawPanel, getPages, loadComicCharacterBriefs, requireOwnedComic, scriptComic, scriptToPages, toComicDetail } from "@/lib/comics";

/** Appends a new page that continues from the last one. */
export const POST = route<{ id: string }>({ policy: "generate" }, async ({ req, user, params }) => {
  const body = await parseBody(req, z.object({ instructions: z.string().max(500).optional() }).default({}));
  if (body.instructions) {
    const r = checkText(body.instructions);
    if (!r.ok) throw new ApiError(422, r.reason, { category: r.category });
  }
  const comic = await requireOwnedComic(params.id, user!);
  const pages = getPages(comic);
  if (pages.length >= 24) throw new ApiError(400, "This comic is at the maximum length");
  const chars = await loadComicCharacterBriefs(comic.id, user!);
  const panelsPerPage = PANELS_PER_LAYOUT[comic.panelLayout] ?? 4;
  const last = pages[pages.length - 1];
  const recap = last ? last.panels.map((p) => [p.caption, ...p.dialogue.map((d) => `${d.speaker}: ${d.text}`)].filter(Boolean).join(" ")).join(" / ").slice(0, 600) : "";
  const premise = `${comic.premise}\n\nWrite the next page (page ${pages.length + 1}) continuing directly from: ${recap}${body.instructions ? `\nAuthor notes: ${body.instructions}` : ""}`;
  const { script } = await scriptComic(user!, { title: comic.title, premise, tone: comic.tone, artStyle: comic.artStyle, pageCount: 1, panelsPerPage, intensity: comic.intensity, characters: chars, seed: pages.length + 1 });
  const sheet = characterSheetLine(chars);
  const mediaIds: (string | null)[] = [];
  let i = pages.length * panelsPerPage;
  for (const panel of script.pages[0]) {
    const drawn = await drawPanel(user!, { imagePrompt: panel.imagePrompt, artStyle: comic.artStyle, orientation: comic.orientation, index: i++, characterSheet: sheet });
    mediaIds.push(drawn.mediaId);
  }
  const [fresh] = scriptToPages(script, [mediaIds]);
  pages.push(fresh);
  if (comic.visibility === "PUBLIC" && comic.status === "PUBLISHED") await prisma.media.updateMany({ where: { id: { in: mediaIds.filter((x): x is string => !!x) } }, data: { visibility: "PUBLIC" } });
  const c = await prisma.comic.update({ where: { id: comic.id }, data: { pagesEnc: encryptJson(pages), pageCount: pages.length }, include: comicInclude });
  return json(await toComicDetail(c, user));
});
