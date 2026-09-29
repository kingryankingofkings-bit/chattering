import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { publishData } from "@/lib/content";
import { requireOwnedStory, storyInclude, toStoryDetail } from "@/lib/stories";

export const POST = route<{ id: string }>({ policy: "write" }, async ({ req, user, params }) => {
  const body = await parseBody(req, z.object({ publish: z.boolean() }));
  const story = await requireOwnedStory(params.id, user!);
  if (story.modStatus === "REMOVED") throw new ApiError(403, "This story was removed by moderation and can't be published");
  if (body.publish && story.modStatus === "HIDDEN") throw new ApiError(403, "This story is under review and can't be published until it's cleared");
  const s = await prisma.story.update({ where: { id: story.id }, data: publishData(body.publish), include: storyInclude });
  return json(await toStoryDetail(s, user));
});
