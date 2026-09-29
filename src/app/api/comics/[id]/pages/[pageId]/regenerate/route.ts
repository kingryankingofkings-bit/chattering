import { prisma } from "@/lib/db";
import { ApiError, json, route } from "@/lib/api";
import { encryptJson } from "@/lib/crypto";
import { PANELS_PER_LAYOUT, characterSheetLine, comicInclude, drawPanel, getPages, loadComicCharacterBriefs, requireOwnedComic, scriptComic, scriptToPages, toComicDetail } from "@/lib/comics";

/** Re-scripts one page and redraws its panels. */
export const POST = route<{ id: string; pageId: string }>({ policy: "generate" }, async ({ user, params }) => {
  const comic = await requireOwnedComic(params.id, user!);
  const pages = getPages(comic);
  const pi = pages.findIndex((p) => p.id === params.pageId);
  if (pi < 0) throw new ApiError(404, "Page not found");
  const chars = await loadComicCharacterBriefs(comic.id, user!);
  const panelsPerPage = pages[pi].panels.length || PANELS_PER_LAYOUT[comic.panelLayout] || 4;
  const premise = `${comic.premise}\n\nRewrite page ${pi + 1} of ${pages.length}${pi > 0 ? ` (it follows: ${pages[pi - 1].panels.map((p) => p.caption || p.dialogue.map((d) => d.text).join(" ")).join(" / ").slice(0, 400)})` : ""}.`;
  const { script } = await scriptComic(user!, { title: comic.title, premise, tone: comic.tone, artStyle: comic.artStyle, pageCount: 1, panelsPerPage, intensity: comic.intensity, characters: chars, seed: Date.now() % 100000 });
  const sheet = characterSheetLine(chars);
  const mediaIds: (string | null)[] = [];
  let i = pi * panelsPerPage;
  for (const panel of script.pages[0]) {
    const drawn = await drawPanel(user!, { imagePrompt: panel.imagePrompt, artStyle: comic.artStyle, orientation: comic.orientation, index: i++ + Math.floor(Math.random() * 1000), characterSheet: sheet });
    mediaIds.push(drawn.mediaId);
  }
  const [fresh] = scriptToPages(script, [mediaIds]);
  pages[pi] = { ...fresh, id: pages[pi].id };
  if (comic.visibility === "PUBLIC" && comic.status === "PUBLISHED") await prisma.media.updateMany({ where: { id: { in: mediaIds.filter((x): x is string => !!x) } }, data: { visibility: "PUBLIC" } });
  const c = await prisma.comic.update({ where: { id: comic.id }, data: { pagesEnc: encryptJson(pages), coverMediaId: pages[0]?.panels[0]?.mediaId ?? comic.coverMediaId }, include: comicInclude });
  return json(await toComicDetail(c, user));
});
