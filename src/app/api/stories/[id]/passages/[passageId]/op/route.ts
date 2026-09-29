import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { encryptJson } from "@/lib/crypto";
import { checkText } from "@/lib/safety";
import type { StoryChapter } from "@/lib/types";
import { uid } from "@/lib/utils";
import { getChapters, requireOwnedStory, rewritePassage, storyInclude, storySummary, storyWordCount, toStoryDetail } from "@/lib/stories";

const schema = z.object({
  operation: z.enum(["continue", "rewrite", "expand", "shorten", "branch", "regenerate"]),
  instructions: z.string().max(500).optional(),
});

/**
 * Passage operations. `continue` inserts new passages after the target; `branch` creates a new
 * story (parentStoryId) holding everything up to the passage plus an alternative continuation and
 * returns `{ branchId }`; every other operation replaces the passage text. Returns the story detail otherwise.
 */
export const POST = route<{ id: string; passageId: string }>({ policy: "generate" }, async ({ req, user, params }) => {
  const body = await parseBody(req, schema);
  if (body.instructions) {
    const r = checkText(body.instructions);
    if (!r.ok) throw new ApiError(422, r.reason, { category: r.category });
  }
  const story = await requireOwnedStory(params.id, user!);
  const chapters = getChapters(story);
  let ci = -1;
  let pi = -1;
  for (let i = 0; i < chapters.length && ci < 0; i++) {
    const j = chapters[i].passages.findIndex((p) => p.id === params.passageId);
    if (j >= 0) {
      ci = i;
      pi = j;
    }
  }
  if (ci < 0) throw new ApiError(404, "Passage not found");
  const link = await prisma.storyCharacter.findFirst({ where: { storyId: story.id }, include: { character: { select: { name: true } } } });
  const passage = chapters[ci].passages[pi];
  const out = await rewritePassage(user!, body.operation, passage.text, body.instructions, link?.character.name);

  if (body.operation === "branch") {
    const kept: StoryChapter[] = chapters.slice(0, ci + 1).map((c, i) => ({ id: uid("ch"), title: c.title, passages: (i === ci ? c.passages.slice(0, pi + 1) : c.passages).map((p) => ({ id: uid("p"), text: p.text })) }));
    kept[ci].passages.push(...out.paragraphs.map((text) => ({ id: uid("p"), text })));
    const links = await prisma.storyCharacter.findMany({ where: { storyId: story.id }, select: { characterId: true } });
    const branch = await prisma.story.create({
      data: {
        authorId: user!.id,
        title: `${story.title} (branch)`.slice(0, 120),
        summary: storySummary(kept),
        genre: story.genre,
        tone: story.tone,
        pov: story.pov,
        tense: story.tense,
        length: story.length,
        intensity: story.intensity,
        endingType: story.endingType,
        tags: story.tags,
        contentEnc: encryptJson(kept),
        wordCount: storyWordCount(kept),
        parentStoryId: story.id,
        provider: out.provider,
        model: out.model,
        status: "DRAFT",
        visibility: "PRIVATE",
        characters: { create: links.map((l) => ({ characterId: l.characterId })) },
      },
    });
    return json({ branchId: branch.id });
  }

  if (body.operation === "continue") {
    chapters[ci].passages.splice(pi + 1, 0, ...out.paragraphs.map((text) => ({ id: uid("p"), text })));
  } else {
    passage.text = out.paragraphs.join("\n\n");
  }
  const s = await prisma.story.update({ where: { id: story.id }, data: { contentEnc: encryptJson(chapters), wordCount: storyWordCount(chapters) }, include: storyInclude });
  return json(await toStoryDetail(s, user));
});
