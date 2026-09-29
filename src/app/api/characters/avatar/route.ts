import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { getImageProvider } from "@/lib/ai";
import { storeMedia } from "@/lib/storage";
import { checkText } from "@/lib/safety";
import { ART_STYLES } from "@/lib/constants";

const schema = z.object({
  prompt: z.string().trim().min(3, "Describe the character's look").max(1000),
  style: z.enum(ART_STYLES).default("painterly"),
});

/** Generate a portrait avatar → private media { mediaId, url }. Publishing the character makes it public. */
export const POST = route({ policy: "image" }, async ({ req, user }) => {
  const body = await parseBody(req, schema);
  const s = checkText(body.prompt);
  if (!s.ok) throw new ApiError(422, s.reason, { category: s.category, field: "prompt" });
  const provider = getImageProvider();
  const started = Date.now();
  try {
    const img = await provider.generate({ prompt: `Portrait of an adult character. ${body.prompt}`, style: body.style, orientation: "portrait" });
    const media = await storeMedia({ ownerId: user!.id, data: img.data, mime: img.mime, width: img.width, height: img.height, visibility: "PRIVATE" });
    await prisma.generation.create({ data: { userId: user!.id, kind: "IMAGE", provider: img.provider, model: img.model, durationMs: Date.now() - started, status: "OK" } });
    return json({ mediaId: media.id, url: `/api/media/${media.id}`, seed: img.seed }, { status: 201 });
  } catch (err) {
    await prisma.generation.create({ data: { userId: user!.id, kind: "IMAGE", provider: provider.name, model: provider.model, durationMs: Date.now() - started, status: "ERROR", error: String(err).slice(0, 300) } });
    throw new ApiError(502, "Couldn't generate an avatar right now. Try again.");
  }
});
