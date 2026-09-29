import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { encryptJson } from "@/lib/crypto";
import { ART_STYLES, COMIC_TONES, ORIENTATION_OPTS, PANEL_LAYOUTS } from "@/lib/constants";
import { checkFields } from "@/lib/safety";
import { loadFeaturedCharacters, loadOwnChatTranscript, pickTitle, premiseFromChat, prefsOf } from "@/lib/content";
import { PANELS_PER_LAYOUT, RANDOM_COMIC_PREMISES, characterSheetLine, drawPanel, scriptComic, scriptToPages } from "@/lib/comics";
import { pick } from "@/lib/utils";

const schema = z.object({
  source: z.enum(["random", "prompt", "characters", "chat"]),
  prompt: z.string().max(2000).optional(),
  characterIds: z.array(z.string().min(1)).max(4).optional(),
  chatId: z.string().optional(),
  title: z.string().max(120).optional(),
  artStyle: z.enum(ART_STYLES).default("noir-ink"),
  pageCount: z.number().int().min(1).max(6).default(1),
  panelLayout: z.enum(PANEL_LAYOUTS).default("grid-4"),
  tone: z.enum(COMIC_TONES).default("sensual"),
  orientation: z.enum(ORIENTATION_OPTS).default("portrait"),
  intensity: z.number().int().min(1).max(3).default(2),
  tags: z.array(z.string().max(30)).max(10).optional(),
});

export const POST = route({ policy: "generate" }, async ({ req, user }) => {
  const body = await parseBody(req, schema);
  const safety = checkFields({ prompt: body.prompt, title: body.title, tags: body.tags });
  if (!safety.ok) throw new ApiError(422, safety.reason, { category: safety.category, field: safety.field });
  const prefs = prefsOf(user);
  const intensity = Math.min(body.intensity, prefs.maxIntensity);

  // Premise
  let premise = "";
  let sourceChatId: string | null = null;
  let characterIds = body.characterIds ?? [];
  if (body.source === "random") premise = pick(Math.random, RANDOM_COMIC_PREMISES);
  else if (body.source === "prompt") {
    if (!body.prompt?.trim()) throw new ApiError(400, "Write a premise first");
    premise = body.prompt.trim();
  } else if (body.source === "chat") {
    if (!body.chatId) throw new ApiError(400, "Pick a chat");
    const t = await loadOwnChatTranscript(body.chatId, user!.id, 20);
    premise = await premiseFromChat(user!.id, "COMIC", t);
    sourceChatId = t.chat.id;
    if (!characterIds.includes(t.chat.characterId)) characterIds = [t.chat.characterId, ...characterIds];
  } else {
    if (characterIds.length === 0) throw new ApiError(400, "Pick at least one character");
    premise = body.prompt?.trim() || pick(Math.random, RANDOM_COMIC_PREMISES);
  }
  const characters = await loadFeaturedCharacters(characterIds, user!);
  if (body.source === "characters" && characters.length === 0) throw new ApiError(404, "Those characters aren't available");
  if (characters.length > 0 && body.source !== "prompt" && body.source !== "chat" && !body.prompt?.trim()) premise = `${premise} Featuring ${characters.map((c) => c.name).join(" and ")}.`;

  const panelsPerPage = PANELS_PER_LAYOUT[body.panelLayout] ?? 4;
  const { script, provider, model } = await scriptComic(user!, { title: body.title, premise, tone: body.tone, artStyle: body.artStyle, pageCount: body.pageCount, panelsPerPage, intensity, characters });

  const characterSheet = characterSheetLine(characters);
  const mediaIds: (string | null)[][] = [];
  let imageProvider: string | null = null;
  let imageModel: string | null = null;
  let index = 0;
  for (const page of script.pages) {
    const row: (string | null)[] = [];
    for (const panel of page) {
      const drawn = await drawPanel(user!, { imagePrompt: panel.imagePrompt, artStyle: body.artStyle, orientation: body.orientation, index: index++, characterSheet });
      imageProvider = drawn.provider;
      imageModel = drawn.model;
      row.push(drawn.mediaId);
    }
    mediaIds.push(row);
  }
  const pages = scriptToPages(script, mediaIds);
  const tags = Array.from(new Set([body.tone, body.artStyle, ...(body.tags ?? []), ...characters.flatMap((c) => c.tags.slice(0, 2))])).slice(0, 12);

  const comic = await prisma.comic.create({
    data: {
      authorId: user!.id,
      title: pickTitle(body.title, script.title, premise),
      premise: premise.slice(0, 2000),
      artStyle: body.artStyle,
      pageCount: pages.length,
      panelLayout: body.panelLayout,
      tone: body.tone,
      orientation: body.orientation,
      intensity,
      tags: JSON.stringify(tags),
      pagesEnc: encryptJson(pages),
      coverMediaId: pages[0]?.panels[0]?.mediaId ?? null,
      sourceChatId,
      provider,
      model,
      imageProvider,
      imageModel,
      status: "DRAFT",
      visibility: "PRIVATE",
      characters: { create: characters.map((c) => ({ characterId: c.id })) },
    },
  });
  return json({ id: comic.id });
});
