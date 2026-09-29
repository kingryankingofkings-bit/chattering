import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { encryptJson } from "@/lib/crypto";
import { ENDINGS, GENRES, POVS, STORY_LENGTHS, TENSES } from "@/lib/constants";
import { checkFields } from "@/lib/safety";
import { latestChatSummary, loadFeaturedCharacters, loadOwnChatTranscript, pickTitle, premiseFromChat, prefsOf } from "@/lib/content";
import { RANDOM_STORY_PREMISES, storySummary, storyWordCount, writeStory } from "@/lib/stories";
import { pick } from "@/lib/utils";

const schema = z.object({
  source: z.enum(["prompt", "characters", "random", "chat"]),
  prompt: z.string().max(3000).optional(),
  characterIds: z.array(z.string().min(1)).max(4).optional(),
  chatId: z.string().optional(),
  title: z.string().max(120).optional(),
  genre: z.enum(GENRES).default("romance"),
  tone: z.string().min(1).max(40).default("sensual"),
  pov: z.enum(POVS).default("second"),
  tense: z.enum(TENSES).default("present"),
  length: z.enum(STORY_LENGTHS).default("short"),
  intensity: z.number().int().min(1).max(3).default(2),
  endingType: z.enum(ENDINGS).default("open"),
  tags: z.array(z.string().max(30)).max(10).optional(),
});

export const POST = route({ policy: "generate" }, async ({ req, user }) => {
  const body = await parseBody(req, schema);
  const safety = checkFields({ prompt: body.prompt, title: body.title, tone: body.tone, tags: body.tags });
  if (!safety.ok) throw new ApiError(422, safety.reason, { category: safety.category, field: safety.field });
  const prefs = prefsOf(user);
  const intensity = Math.min(body.intensity, prefs.maxIntensity);

  let premise = "";
  let sourceChatId: string | null = null;
  let characterIds = body.characterIds ?? [];
  let continuity: string | undefined;
  if (body.source === "random") premise = pick(Math.random, RANDOM_STORY_PREMISES);
  else if (body.source === "prompt") {
    if (!body.prompt?.trim()) throw new ApiError(400, "Write a premise first");
    premise = body.prompt.trim();
  } else if (body.source === "chat") {
    if (!body.chatId) throw new ApiError(400, "Pick a chat");
    const t = await loadOwnChatTranscript(body.chatId, user!.id, 20);
    premise = await premiseFromChat(user!.id, "STORY", t);
    sourceChatId = t.chat.id;
    continuity = t.summary ?? undefined;
    if (!characterIds.includes(t.chat.characterId)) characterIds = [t.chat.characterId, ...characterIds];
  } else {
    if (characterIds.length === 0) throw new ApiError(400, "Pick at least one character");
    premise = body.prompt?.trim() || pick(Math.random, RANDOM_STORY_PREMISES);
  }
  const characters = await loadFeaturedCharacters(characterIds, user!);
  if (body.source === "characters" && characters.length === 0) throw new ApiError(404, "Those characters aren't available");
  if (characters.length > 0 && !body.prompt?.trim() && body.source !== "chat") premise = `${premise} Featuring ${characters.map((c) => c.name).join(" and ")}.`;

  // Continuity: character memories plus the latest rolling chat summary the user has with each character.
  const notes: string[] = [];
  if (continuity) notes.push(continuity);
  for (const c of characters) {
    if (c.memories.length) notes.push(`${c.name} remembers: ${c.memories.slice(0, 5).join("; ")}`);
    const s = await latestChatSummary(user!.id, c.id);
    if (s) notes.push(`Previously with ${c.name}: ${s}`);
  }

  const out = await writeStory(user!, { title: body.title, prompt: premise, genre: body.genre, tone: body.tone, pov: body.pov, tense: body.tense, length: body.length, intensity, endingType: body.endingType, characters, continuity: notes.length ? notes.join("\n").slice(0, 2000) : undefined });
  const tags = Array.from(new Set([body.genre, body.tone, ...(body.tags ?? []), ...characters.flatMap((c) => c.tags.slice(0, 2))])).slice(0, 12);
  const story = await prisma.story.create({
    data: {
      authorId: user!.id,
      title: pickTitle(body.title, out.title, premise),
      summary: storySummary(out.chapters),
      genre: body.genre,
      tone: body.tone,
      pov: body.pov,
      tense: body.tense,
      length: body.length,
      intensity,
      endingType: body.endingType,
      tags: JSON.stringify(tags),
      contentEnc: encryptJson(out.chapters),
      wordCount: storyWordCount(out.chapters),
      sourceChatId,
      provider: out.provider,
      model: out.model,
      status: "DRAFT",
      visibility: "PRIVATE",
      characters: { create: characters.map((c) => ({ characterId: c.id })) },
    },
  });
  return json({ id: story.id });
});
