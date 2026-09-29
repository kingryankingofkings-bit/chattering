import "server-only";
import type { Comic, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { decryptJson } from "./crypto";
import { getImageProvider, getTextProvider } from "./ai";
import { buildComicPrompt } from "./ai/prompts";
import { storeMedia } from "./storage";
import { ApiError, parseJsonArray } from "./api";
import { checkText } from "./safety";
import type { SafeUser } from "./auth";
import type { ComicPage, ComicPanel } from "./types";
import { hash32, uid } from "./utils";
import { authorSelect, characterLinkSelect, isFollowing, isOwnerOrMod, loadFeaturedCharacters, mediaUrl, reactionBreakdown, toCharacterLink, trackGeneration, parseJsonLoose, viewerContentMarks, type Author, type CharacterLink, type PromptCharacterBrief, type ViewerMarks } from "./content";

export const PANELS_PER_LAYOUT: Record<string, number> = { "grid-4": 4, "grid-6": 6, "strip-3": 3, splash: 1 };

export const RANDOM_COMIC_PREMISES = [
  "Two rival chefs are locked in a restaurant kitchen after close, and the only thing hotter than the stove is the argument.",
  "A vampire duke receives a late-night visitor who refuses to be intimidated and insists on winning at chess first.",
  "An android racer loses for the first time and demands the winner explain, over drinks, in detail.",
  "A hedge witch's cottage won't let a traveler leave until the storm passes; the storm is in no hurry.",
  "The last customer at a speakeasy and the bartender who has been pretending to clean for an hour.",
  "A pirate captain negotiates the ransom of a prisoner nobody is coming to pay for.",
  "A knight sworn to protect a noble is trapped with them in a watchtower with one cloak and one fire.",
  "A CEO falls asleep on the office couch and wakes to find the one employee who never leaves early.",
  "A masked stranger at a ballroom has watched all night, and finally asks for the last dance.",
  "A demon summoned by a botched ritual is far more interested in the summoner than in the terms.",
  "Two exes meet at a wedding neither wanted to attend; one still remembers the other's coffee order.",
  "A dancer and the tourist who stayed after the show, sharing olives and increasingly bad ideas.",
];

export type ComicScriptPanel = { caption: string; dialogue: { speaker: string; text: string }[]; sfx: string[]; imagePrompt: string };
export type ComicScript = { title: string; pages: ComicScriptPanel[][] };

function str(v: unknown, max = 600): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

/** Normalizes a model response into a script with exactly `pageCount` pages of `per` panels; falls back to a minimal script. */
export function parseComicScript(text: string, opts: { pageCount: number; panelsPerPage: number; premise: string; title?: string }): ComicScript {
  const raw = parseJsonLoose<{ title?: unknown; pages?: unknown }>(text);
  const pages: ComicScriptPanel[][] = [];
  const rawPages = Array.isArray(raw?.pages) ? (raw!.pages as unknown[]) : [];
  for (const rp of rawPages) {
    const panelsRaw = rp && typeof rp === "object" && Array.isArray((rp as { panels?: unknown }).panels) ? ((rp as { panels: unknown[] }).panels) : [];
    const panels: ComicScriptPanel[] = panelsRaw.map((p) => {
      const o = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
      const dialogue = Array.isArray(o.dialogue)
        ? (o.dialogue as unknown[])
            .map((d) => {
              const dd = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
              return { speaker: str(dd.speaker, 60), text: str(dd.text, 300) };
            })
            .filter((d) => d.text)
        : [];
      const sfx = Array.isArray(o.sfx) ? (o.sfx as unknown[]).map((s) => str(s, 30)).filter(Boolean).slice(0, 3) : [];
      return { caption: str(o.caption, 300), dialogue: dialogue.slice(0, 4), sfx, imagePrompt: str(o.imagePrompt, 800) };
    });
    if (panels.length) pages.push(panels);
  }
  // Pad or trim to the requested shape so the layout always renders.
  const target = Math.max(1, opts.pageCount);
  while (pages.length < target) pages.push([]);
  const out = pages.slice(0, target).map((panels, pi) => {
    const fixed = panels.slice(0, opts.panelsPerPage);
    while (fixed.length < opts.panelsPerPage) {
      const i = fixed.length;
      fixed.push({ caption: i === 0 && pi === 0 ? opts.premise.slice(0, 200) : "", dialogue: [], sfx: [], imagePrompt: `${opts.premise.slice(0, 300)} — page ${pi + 1}, panel ${i + 1}` });
    }
    return fixed.map((p) => ({ ...p, imagePrompt: p.imagePrompt || `${opts.premise.slice(0, 300)} — page ${pi + 1}` }));
  });
  const title = str(raw?.title, 120) || opts.title || "Untitled comic";
  return { title, pages: out };
}

export function characterSheetLine(chars: PromptCharacterBrief[]): string | undefined {
  if (chars.length === 0) return undefined;
  return chars.map((c) => `${c.name}: ${c.appearance || c.description}`).join(" | ");
}

/** Runs the script prompt and records the generation. */
export async function scriptComic(user: SafeUser, opts: { title?: string; premise: string; tone: string; artStyle: string; pageCount: number; panelsPerPage: number; intensity: number; characters: PromptCharacterBrief[]; seed?: number }) {
  const text = getTextProvider();
  const built = buildComicPrompt({ title: opts.title, premise: opts.premise, tone: opts.tone, artStyle: opts.artStyle, pageCount: opts.pageCount, panelsPerPage: opts.panelsPerPage, intensity: opts.intensity, characters: opts.characters.map((c) => ({ name: c.name, appearance: c.appearance, personality: c.personality })) });
  const out = await trackGeneration(user.id, "COMIC", { provider: text.name, model: text.model }, () =>
    text.complete({
      system: built.system,
      messages: [{ role: "user", content: built.user }],
      json: true,
      maxTokens: 3000,
      meta: { kind: "comic", pageCount: opts.pageCount, panelsPerPage: opts.panelsPerPage, tone: opts.tone, intensity: opts.intensity, title: opts.title, characterName: opts.characters[0]?.name, userName: opts.characters[1]?.name, seed: opts.seed },
    }),
  );
  const script = parseComicScript(out.text, { pageCount: opts.pageCount, panelsPerPage: opts.panelsPerPage, premise: opts.premise, title: opts.title });
  // Script text is model output, but it becomes user-visible content: keep the guardrail on it too.
  for (const page of script.pages) for (const p of page) {
    const r = checkText([p.caption, ...p.dialogue.map((d) => d.text), p.imagePrompt].join(" "));
    if (!r.ok) throw new ApiError(422, r.reason, { category: r.category });
  }
  return { script, provider: out.provider, model: out.model };
}

/** Draws one panel to PRIVATE media and records the generation. */
export async function drawPanel(user: SafeUser, opts: { imagePrompt: string; artStyle: string; orientation: string; index: number; characterSheet?: string }) {
  const images = getImageProvider();
  const orientation = (["portrait", "landscape", "square"].includes(opts.orientation) ? opts.orientation : "portrait") as "portrait" | "landscape" | "square";
  const img = await trackGeneration(user.id, "IMAGE", { provider: images.name, model: images.model }, () =>
    images.generate({ prompt: opts.imagePrompt, style: opts.artStyle, orientation, seed: (hash32(opts.imagePrompt) + opts.index) >>> 0, characterSheet: opts.characterSheet }),
  );
  const media = await storeMedia({ ownerId: user.id, data: img.data, mime: img.mime, width: img.width, height: img.height, visibility: "PRIVATE" });
  return { mediaId: media.id, provider: img.provider, model: img.model };
}

export function scriptToPages(script: ComicScript, mediaIds: (string | null)[][]): ComicPage[] {
  return script.pages.map((panels, pi) => ({
    id: uid("pg"),
    panels: panels.map((p, i) => ({ id: uid("pn"), caption: p.caption, dialogue: p.dialogue, sfx: p.sfx, imagePrompt: p.imagePrompt, mediaId: mediaIds[pi]?.[i] ?? null })),
  }));
}

export function pagesMediaIds(pages: ComicPage[]): string[] {
  return pages.flatMap((p) => p.panels.map((x) => x.mediaId)).filter((x): x is string => !!x);
}

export function getPages(c: Comic): ComicPage[] {
  const pages = decryptJson<ComicPage[]>(c.pagesEnc, []);
  return Array.isArray(pages) ? pages : [];
}

/** Validates user-edited pages: shape, sizes and safety. */
export function sanitizePages(input: unknown): ComicPage[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > 24) throw new ApiError(400, "Pages must be a non-empty list");
  return input.map((pg) => {
    const o = (pg && typeof pg === "object" ? pg : {}) as Record<string, unknown>;
    const panels = Array.isArray(o.panels) ? (o.panels as unknown[]) : [];
    if (panels.length === 0 || panels.length > 6) throw new ApiError(400, "Each page needs 1-6 panels");
    const page: ComicPage = {
      id: str(o.id, 40) || uid("pg"),
      panels: panels.map((pn) => {
        const p = (pn && typeof pn === "object" ? pn : {}) as Record<string, unknown>;
        const dialogue = Array.isArray(p.dialogue)
          ? (p.dialogue as unknown[]).slice(0, 6).map((d) => {
              const dd = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
              return { speaker: str(dd.speaker, 60), text: str(dd.text, 300) };
            })
          : [];
        const panel: ComicPanel = { id: str(p.id, 40) || uid("pn"), caption: str(p.caption, 300), dialogue, sfx: Array.isArray(p.sfx) ? (p.sfx as unknown[]).map((s) => str(s, 30)).filter(Boolean).slice(0, 3) : [], imagePrompt: str(p.imagePrompt, 800), mediaId: typeof p.mediaId === "string" ? p.mediaId : null };
        const r = checkText([panel.caption, ...panel.dialogue.map((d) => `${d.speaker} ${d.text}`), ...panel.sfx, panel.imagePrompt].join(" "));
        if (!r.ok) throw new ApiError(422, r.reason, { category: r.category });
        return panel;
      }),
    };
    return page;
  });
}

/* ---------------- Client shapes ---------------- */

export type ComicCard = {
  id: string;
  title: string;
  premise: string;
  coverUrl: string | null;
  artStyle: string;
  pageCount: number;
  panelLayout: string;
  orientation: string;
  intensity: number;
  tags: string[];
  author: Author;
  likeCount: number;
  favoriteCount: number;
  viewCount: number;
  status: string;
  visibility: string;
  modStatus: string;
  createdAt: string;
  publishedAt: string | null;
  isOwner: boolean;
  isFavorite: boolean;
  reaction: string | null;
};

export type ComicWithAuthor = Comic & { author: Author };
export const comicInclude = { author: { select: authorSelect } } as const;

export function toComicCard(c: ComicWithAuthor, viewerId: string | null, marks?: ViewerMarks): ComicCard {
  return {
    id: c.id,
    title: c.title,
    premise: c.premise,
    coverUrl: mediaUrl(c.coverMediaId),
    artStyle: c.artStyle,
    pageCount: c.pageCount,
    panelLayout: c.panelLayout,
    orientation: c.orientation,
    intensity: c.intensity,
    tags: parseJsonArray(c.tags),
    author: c.author,
    likeCount: c.likeCount,
    favoriteCount: c.favoriteCount,
    viewCount: c.viewCount,
    status: c.status,
    visibility: c.visibility,
    modStatus: c.modStatus,
    createdAt: c.createdAt.toISOString(),
    publishedAt: c.publishedAt?.toISOString() ?? null,
    isOwner: c.authorId === viewerId,
    isFavorite: marks?.favorites.has(c.id) ?? false,
    reaction: marks?.reactions.get(c.id) ?? null,
  };
}

export type ComicDetail = ComicCard & {
  tone: string;
  pages: ComicPage[];
  characters: CharacterLink[];
  reactions: Record<string, number>;
  isFollowing: boolean;
  generation: { provider: string | null; model: string | null; imageProvider: string | null; imageModel: string | null; sourceChatId: string | null } | null;
};

export async function toComicDetail(c: ComicWithAuthor, user: SafeUser | null): Promise<ComicDetail> {
  const viewerId = user?.id ?? null;
  const [marks, links, reactions, following] = await Promise.all([
    viewerContentMarks(viewerId, "comic", [c.id]),
    prisma.comicCharacter.findMany({ where: { comicId: c.id }, include: { character: { select: characterLinkSelect } } }),
    reactionBreakdown("comic", c.id),
    isFollowing(viewerId, c.authorId),
  ]);
  const card = toComicCard(c, viewerId, marks);
  const owner = isOwnerOrMod({ ownerId: c.authorId }, user);
  return {
    ...card,
    tone: c.tone,
    pages: getPages(c),
    characters: links.map((l) => toCharacterLink(l.character)),
    reactions,
    isFollowing: following,
    generation: owner ? { provider: c.provider, model: c.model, imageProvider: c.imageProvider, imageModel: c.imageModel, sourceChatId: c.sourceChatId } : null,
  };
}

export async function requireOwnedComic(id: string, user: SafeUser): Promise<Comic> {
  const c = await prisma.comic.findUnique({ where: { id } });
  if (!c || c.authorId !== user.id) throw new ApiError(404, "Comic not found");
  return c;
}

export async function loadComicCharacterBriefs(comicId: string, user: SafeUser): Promise<PromptCharacterBrief[]> {
  const links = await prisma.comicCharacter.findMany({ where: { comicId }, select: { characterId: true } });
  return loadFeaturedCharacters(links.map((l) => l.characterId), user);
}

export function comicSearchWhere(q: string | undefined): Prisma.ComicWhereInput | undefined {
  if (!q) return undefined;
  const s = q.trim().slice(0, 80);
  if (!s) return undefined;
  return { OR: [{ title: { contains: s } }, { premise: { contains: s } }, { tags: { contains: s } }] };
}
