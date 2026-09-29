import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { ART_STYLES, ORIENTATION_OPTS } from "@/lib/constants";
import { checkFields } from "@/lib/safety";
import { canView } from "@/lib/characters";
import { isModerator } from "@/lib/auth";
import { mediaUrl, prefsOf } from "@/lib/content";
import { generateOneImage } from "@/lib/images";

const schema = z.object({
  prompt: z.string().min(3).max(1500),
  negativePrompt: z.string().max(600).optional(),
  style: z.enum(ART_STYLES).default("painterly"),
  orientation: z.enum(ORIENTATION_OPTS).default("portrait"),
  intensity: z.number().int().min(1).max(3).default(2),
  characterId: z.string().max(64).optional().nullable(),
  seed: z.number().int().min(0).max(2147483646).optional().nullable(),
  count: z.number().int().min(1).max(4).default(1),
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
  title: z.string().max(120).optional(),
  parentImageId: z.string().max(64).optional().nullable(),
  showDetails: z.boolean().optional(),
  allowRemix: z.boolean().optional(),
});

export const POST = route({ policy: "image" }, async ({ req, user }) => {
  const body = await parseBody(req, schema);
  const safety = checkFields({ prompt: body.prompt, negativePrompt: body.negativePrompt, title: body.title, tags: body.tags });
  if (!safety.ok) throw new ApiError(422, safety.reason, { category: safety.category, field: safety.field });
  const prefs = prefsOf(user);
  const intensity = Math.min(body.intensity, prefs.maxIntensity);

  let character: { id: string; name: string; appearance: string } | null = null;
  if (body.characterId) {
    const c = await prisma.character.findUnique({ where: { id: body.characterId } });
    if (!c || !canView(c, user!.id, isModerator(user))) throw new ApiError(404, "Character not found");
    character = { id: c.id, name: c.name, appearance: c.appearance };
  }
  let parentImageId: string | null = null;
  if (body.parentImageId) {
    const p = await prisma.generatedImage.findUnique({ where: { id: body.parentImageId }, select: { id: true, ownerId: true, allowRemix: true, visibility: true, status: true, modStatus: true } });
    const own = p?.ownerId === user!.id;
    const remixable = !!p && (own || (p.allowRemix && p.visibility === "PUBLIC" && p.status === "PUBLISHED" && p.modStatus === "ACTIVE"));
    if (!remixable) throw new ApiError(403, "That image can't be remixed");
    parentImageId = p!.id;
  }

  const items: { id: string; url: string }[] = [];
  for (let i = 0; i < body.count; i++) {
    const seed = body.seed != null ? (body.count > 1 ? body.seed + i : body.seed) : undefined;
    const g = await generateOneImage(user!, { prompt: body.prompt.trim(), negativePrompt: body.negativePrompt?.trim() || undefined, style: body.style, orientation: body.orientation, intensity, seed, title: body.title?.trim(), tags: body.tags ?? [], character, parentImageId, showDetails: body.showDetails, allowRemix: body.allowRemix });
    items.push({ id: g.id, url: mediaUrl(g.mediaId)! });
  }
  return json({ items });
});
