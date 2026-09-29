import { prisma } from "@/lib/db";
import { ApiError, json, route } from "@/lib/api";
import { encryptJson } from "@/lib/crypto";
import { requireOwnedStory, sanitizeChapters, storyInclude, storySummary, storyWordCount, toStoryDetail } from "@/lib/stories";

/** Replace the full chapter list (inline passage edits, chapter add/rename/reorder/delete). */
export const PUT = route<{ id: string }>({ policy: "write" }, async ({ req, user, params }) => {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "Body must be JSON");
  }
  const body = (raw && typeof raw === "object" ? raw : {}) as { chapters?: unknown };
  const story = await requireOwnedStory(params.id, user!);
  const chapters = sanitizeChapters(body.chapters);
  const s = await prisma.story.update({ where: { id: story.id }, data: { contentEnc: encryptJson(chapters), wordCount: storyWordCount(chapters), summary: story.summary || storySummary(chapters) }, include: storyInclude });
  return json(await toStoryDetail(s, user));
});
