import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { publishData, setMediaVisibility } from "@/lib/content";
import { comicInclude, getPages, pagesMediaIds, requireOwnedComic, toComicDetail } from "@/lib/comics";

/** Publish (PUBLIC + PUBLISHED, media public) or keep private (reverses it). */
export const POST = route<{ id: string }>({ policy: "write" }, async ({ req, user, params }) => {
  const body = await parseBody(req, z.object({ publish: z.boolean() }));
  const comic = await requireOwnedComic(params.id, user!);
  if (comic.modStatus === "REMOVED") throw new ApiError(403, "This comic was removed by moderation and can't be published");
  if (body.publish && comic.modStatus === "HIDDEN") throw new ApiError(403, "This comic is under review and can't be published until it's cleared");
  const mediaIds = [...pagesMediaIds(getPages(comic)), comic.coverMediaId];
  await setMediaVisibility(mediaIds, body.publish ? "PUBLIC" : "PRIVATE");
  const c = await prisma.comic.update({ where: { id: comic.id }, data: publishData(body.publish), include: comicInclude });
  return json(await toComicDetail(c, user));
});
