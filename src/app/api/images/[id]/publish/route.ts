import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { publishData, setMediaVisibility } from "@/lib/content";
import { imageInclude, requireOwnedImage, toImageDetail } from "@/lib/images";

export const POST = route<{ id: string }>({ policy: "write" }, async ({ req, user, params }) => {
  const body = await parseBody(req, z.object({ publish: z.boolean() }));
  const g0 = await requireOwnedImage(params.id, user!);
  if (g0.modStatus === "REMOVED") throw new ApiError(403, "This image was removed by moderation and can't be published");
  if (body.publish && g0.modStatus === "HIDDEN") throw new ApiError(403, "This image is under review and can't be published until it's cleared");
  await setMediaVisibility([g0.mediaId], body.publish ? "PUBLIC" : "PRIVATE");
  const g = await prisma.generatedImage.update({ where: { id: g0.id }, data: publishData(body.publish), include: imageInclude });
  return json(await toImageDetail(g, user));
});
