import { prisma } from "@/lib/db";
import { ApiError, json, route } from "@/lib/api";
import { encryptJson } from "@/lib/crypto";
import { comicInclude, getPages, pagesMediaIds, requireOwnedComic, sanitizePages, toComicDetail } from "@/lib/comics";

/** Replace the full page list (inline dialogue/caption edits, reordering). Panels can't gain media ids they didn't already own. */
export const PUT = route<{ id: string }>({ policy: "write" }, async ({ req, user, params }) => {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "Body must be JSON");
  }
  const body = (raw && typeof raw === "object" ? raw : {}) as { pages?: unknown };
  const comic = await requireOwnedComic(params.id, user!);
  const allowed = new Set(pagesMediaIds(getPages(comic)));
  const pages = sanitizePages(body.pages).map((p) => ({ ...p, panels: p.panels.map((pn) => ({ ...pn, mediaId: pn.mediaId && allowed.has(pn.mediaId) ? pn.mediaId : null })) }));
  const c = await prisma.comic.update({ where: { id: comic.id }, data: { pagesEnc: encryptJson(pages), pageCount: pages.length, coverMediaId: pages[0]?.panels[0]?.mediaId ?? comic.coverMediaId }, include: comicInclude });
  return json(await toComicDetail(c, user));
});
