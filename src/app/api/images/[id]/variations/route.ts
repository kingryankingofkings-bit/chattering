import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { mediaUrl } from "@/lib/content";
import { decryptPrompt, generateOneImage, requireOwnedImage } from "@/lib/images";
import { parseJsonArray } from "@/lib/api";

/** Same prompt and settings, fresh seeds, linked via parentImageId. */
export const POST = route<{ id: string }>({ policy: "image" }, async ({ req, user, params }) => {
  const body = await parseBody(req, z.object({ count: z.number().int().min(1).max(4).default(2) }).default({ count: 2 }));
  const parent = await requireOwnedImage(params.id, user!);
  const prompt = decryptPrompt(parent.promptEnc);
  if (!prompt) throw new ApiError(400, "This image has no prompt to vary");
  let character: { id: string; name: string; appearance: string } | null = null;
  if (parent.characterId) {
    const c = await prisma.character.findUnique({ where: { id: parent.characterId }, select: { id: true, name: true, appearance: true } });
    if (c) character = c;
  }
  const orientation = (["portrait", "landscape", "square"].includes(parent.orientation) ? parent.orientation : "portrait") as "portrait" | "landscape" | "square";
  const items: { id: string; url: string }[] = [];
  for (let i = 0; i < body.count; i++) {
    const g = await generateOneImage(user!, { prompt, negativePrompt: decryptPrompt(parent.negativeEnc) || undefined, style: parent.style, orientation, intensity: parent.intensity, title: parent.title, tags: parseJsonArray(parent.tags), character, parentImageId: parent.id, showDetails: parent.showDetails, allowRemix: parent.allowRemix });
    items.push({ id: g.id, url: mediaUrl(g.mediaId)! });
  }
  return json({ items });
});
