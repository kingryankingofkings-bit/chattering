import { prisma } from "@/lib/db";
import { ApiError, json, route } from "@/lib/api";
import { CONTENT_TYPES, contentAccess, findContent, setContentFavorite, type ContentType } from "@/lib/content";

function parseType(t: string): ContentType {
  if (!(CONTENT_TYPES as readonly string[]).includes(t)) throw new ApiError(404, "Unknown content type");
  return t as ContentType;
}

export const POST = route<{ type: string; id: string }>({ policy: "write" }, async ({ user, params }) => {
  const type = parseType(params.type);
  const row = await findContent(type, params.id);
  if (!row || contentAccess(row, user) !== "ok") throw new ApiError(404, "Not found");
  await setContentFavorite(type, row.id, user!.id, true);
  return json({ ok: true, favorite: true });
});

export const DELETE = route<{ type: string; id: string }>({ policy: "write" }, async ({ user, params }) => {
  const type = parseType(params.type);
  const exists = await prisma.contentFavorite.findFirst({ where: { userId: user!.id, targetId: params.id } });
  if (exists) await setContentFavorite(type, params.id, user!.id, false);
  return json({ ok: true, favorite: false });
});
