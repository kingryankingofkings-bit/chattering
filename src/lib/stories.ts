import "server-only";
import type { Prisma, Story } from "@prisma/client";
import { prisma } from "./db";
import { decryptJson } from "./crypto";
import { getTextProvider } from "./ai";
import { buildRewritePrompt, buildStoryPrompt } from "./ai/prompts";
import { ApiError, parseJsonArray } from "./api";
import { checkText } from "./safety";
import type { SafeUser } from "./auth";
import type { StoryChapter } from "./types";
import { countWords, uid } from "./utils";
import { authorSelect, characterLinkSelect, isFollowing, isOwnerOrMod, reactionBreakdown, toCharacterLink, trackGeneration, parseJsonLoose, truncate, viewerContentMarks, type Author, type CharacterLink, type PromptCharacterBrief, type ViewerMarks } from "./content";

export const RANDOM_STORY_PREMISES = [
  "A bartender who remembers every order and every secret finally meets the one customer she can't read.",
  "Snowed in at a mountain estate, a guest discovers the reclusive host has been leaving books on their pillow.",
  "A street-racing android loses for the first time and wants to understand the feeling, preferably up close.",
  "A widowed countess hires a secretary and immediately makes other plans for them.",
  "Ten years after the breakup, two exes are seated together at a wedding neither wanted to attend.",
  "A hedge witch's door won't open until the rain stops, and the rain has opinions.",
  "A detective across the hall knocks during a blackout with a flashlight and two mugs of coffee.",
  "A pirate captain must decide what a prisoner nobody is paying for is worth to her.",
  "A knight who broke an oath to save a noble now guards them in disgrace, and in silence.",
  "A CEO who hates his glass apartment starts texting the one employee who talks back.",
  "A demon summoned by mistake refuses to leave until dinner has been served.",
  "An elf archivist supervising a visitor's week in the restricted archive keeps losing her place.",
];

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

/** Parses `{title, chapters:[{title, passages}]}`; falls back to splitting the raw text by blank lines. */
export function parseStoryScript(text: string, fallbackTitle: string): { title: string; chapters: StoryChapter[] } {
  const raw = parseJsonLoose<{ title?: unknown; chapters?: unknown }>(text);
  const chapters: StoryChapter[] = [];
  if (raw && Array.isArray(raw.chapters)) {
    for (const ch of raw.chapters as unknown[]) {
      const o = (ch && typeof ch === "object" ? ch : {}) as Record<string, unknown>;
      const passages = Array.isArray(o.passages) ? (o.passages as unknown[]).map((p) => (typeof p === "string" ? p : str((p as Record<string, unknown>)?.text, 6000))).map((p) => p.trim()).filter(Boolean) : [];
      if (passages.length) chapters.push({ id: uid("ch"), title: str(o.title, 120) || `Chapter ${chapters.length + 1}`, passages: passages.map((t) => ({ id: uid("p"), text: t.slice(0, 6000) })) });
    }
  }
  if (chapters.length === 0) {
    const paras = text
      .replace(/```[a-z]*\n?|```/gi, "")
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p && !p.startsWith("{") && !p.startsWith("}"));
    chapters.push({ id: uid("ch"), title: fallbackTitle, passages: (paras.length ? paras : ["…"]).map((t) => ({ id: uid("p"), text: t.slice(0, 6000) })) });
  }
  const title = (raw && str(raw.title, 120)) || fallbackTitle;
  return { title, chapters };
}

export function storyWordCount(chapters: StoryChapter[]) {
  return chapters.reduce((n, c) => n + c.passages.reduce((m, p) => m + countWords(p.text), 0), 0);
}

export function storySummary(chapters: StoryChapter[]) {
  const first = chapters[0]?.passages[0]?.text ?? "";
  return truncate(first, 200);
}

export function getChapters(s: Story): StoryChapter[] {
  const ch = decryptJson<StoryChapter[]>(s.contentEnc, []);
  return Array.isArray(ch) ? ch : [];
}

/** Validates user-edited chapters: shape, size limits, safety. */
export function sanitizeChapters(input: unknown): StoryChapter[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > 60) throw new ApiError(400, "Chapters must be a non-empty list");
  return input.map((ch, i) => {
    const o = (ch && typeof ch === "object" ? ch : {}) as Record<string, unknown>;
    const passagesRaw = Array.isArray(o.passages) ? (o.passages as unknown[]) : [];
    if (passagesRaw.length > 400) throw new ApiError(400, "Too many passages in one chapter");
    const title = str(o.title, 120) || `Chapter ${i + 1}`;
    const t = checkText(title);
    if (!t.ok) throw new ApiError(422, t.reason, { category: t.category });
    const passages = passagesRaw.map((p) => {
      const po = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
      const text = str(po.text, 8000);
      const r = checkText(text);
      if (!r.ok) throw new ApiError(422, r.reason, { category: r.category });
      return { id: str(po.id, 40) || uid("p"), text };
    });
    return { id: str(o.id, 40) || uid("ch"), title, passages };
  });
}

export async function writeStory(user: SafeUser, opts: { title?: string; prompt: string; genre: string; tone: string; pov: string; tense: string; length: string; intensity: number; endingType: string; characters: PromptCharacterBrief[]; continuity?: string; seed?: number }) {
  const text = getTextProvider();
  const built = buildStoryPrompt({ ...opts, characters: opts.characters.map((c) => ({ name: c.name, description: c.description, appearance: c.appearance, personality: c.personality })) });
  const out = await trackGeneration(user.id, "STORY", { provider: text.name, model: text.model }, () =>
    text.complete({
      system: built.system,
      messages: [{ role: "user", content: built.user }],
      json: true,
      maxTokens: opts.length === "long" ? 6000 : opts.length === "medium" ? 4000 : 2500,
      meta: { kind: "story", title: opts.title, genre: opts.genre, tone: opts.tone, pov: opts.pov, tense: opts.tense, length: opts.length, intensity: opts.intensity, endingType: opts.endingType, characterName: opts.characters[0]?.name, userName: opts.characters[1]?.name, seed: opts.seed },
    }),
  );
  const parsed = parseStoryScript(out.text, opts.title || "Untitled");
  for (const ch of parsed.chapters) for (const p of ch.passages) {
    const r = checkText(p.text);
    if (!r.ok) throw new ApiError(422, r.reason, { category: r.category });
  }
  return { ...parsed, provider: out.provider, model: out.model };
}

export async function rewritePassage(user: SafeUser, operation: string, passage: string, instructions: string | undefined, characterName?: string) {
  const text = getTextProvider();
  const built = buildRewritePrompt(operation, passage, instructions);
  const out = await trackGeneration(user.id, "STORY", { provider: text.name, model: text.model }, () =>
    text.complete({ system: built.system, messages: [{ role: "user", content: built.user }], maxTokens: 1500, meta: { kind: "rewrite", operation, characterName } }),
  );
  const paras = out.text
    .replace(/```[a-z]*\n?|```/gi, "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  for (const p of paras) {
    const r = checkText(p);
    if (!r.ok) throw new ApiError(422, r.reason, { category: r.category });
  }
  return { paragraphs: paras.length ? paras : [out.text.trim()], provider: out.provider, model: out.model };
}

/* ---------------- Client shapes ---------------- */

export type StoryCard = {
  id: string;
  title: string;
  summary: string;
  genre: string;
  tone: string;
  pov: string;
  tense: string;
  length: string;
  endingType: string;
  wordCount: number;
  intensity: number;
  tags: string[];
  author: Author;
  likeCount: number;
  favoriteCount: number;
  viewCount: number;
  status: string;
  visibility: string;
  modStatus: string;
  parentStoryId: string | null;
  createdAt: string;
  publishedAt: string | null;
  isOwner: boolean;
  isFavorite: boolean;
  reaction: string | null;
};

export type StoryWithAuthor = Story & { author: Author };
export const storyInclude = { author: { select: authorSelect } } as const;

export function toStoryCard(s: StoryWithAuthor, viewerId: string | null, marks?: ViewerMarks): StoryCard {
  return {
    id: s.id,
    title: s.title,
    summary: s.summary,
    genre: s.genre,
    tone: s.tone,
    pov: s.pov,
    tense: s.tense,
    length: s.length,
    endingType: s.endingType,
    wordCount: s.wordCount,
    intensity: s.intensity,
    tags: parseJsonArray(s.tags),
    author: s.author,
    likeCount: s.likeCount,
    favoriteCount: s.favoriteCount,
    viewCount: s.viewCount,
    status: s.status,
    visibility: s.visibility,
    modStatus: s.modStatus,
    parentStoryId: s.parentStoryId,
    createdAt: s.createdAt.toISOString(),
    publishedAt: s.publishedAt?.toISOString() ?? null,
    isOwner: s.authorId === viewerId,
    isFavorite: marks?.favorites.has(s.id) ?? false,
    reaction: marks?.reactions.get(s.id) ?? null,
  };
}

export type StoryDetail = StoryCard & {
  chapters: StoryChapter[];
  characters: CharacterLink[];
  reactions: Record<string, number>;
  isFollowing: boolean;
  bookmark: { chapterIndex: number; scrollRatio: number } | null;
  generation: { provider: string | null; model: string | null; sourceChatId: string | null } | null;
};

export async function toStoryDetail(s: StoryWithAuthor, user: SafeUser | null): Promise<StoryDetail> {
  const viewerId = user?.id ?? null;
  const [marks, links, reactions, following, bookmark] = await Promise.all([
    viewerContentMarks(viewerId, "story", [s.id]),
    prisma.storyCharacter.findMany({ where: { storyId: s.id }, include: { character: { select: characterLinkSelect } } }),
    reactionBreakdown("story", s.id),
    isFollowing(viewerId, s.authorId),
    viewerId ? prisma.bookmark.findUnique({ where: { userId_storyId: { userId: viewerId, storyId: s.id } } }) : Promise.resolve(null),
  ]);
  const owner = isOwnerOrMod({ ownerId: s.authorId }, user);
  return {
    ...toStoryCard(s, viewerId, marks),
    chapters: getChapters(s),
    characters: links.map((l) => toCharacterLink(l.character)),
    reactions,
    isFollowing: following,
    bookmark: bookmark ? { chapterIndex: bookmark.chapterIndex, scrollRatio: bookmark.scrollRatio } : null,
    generation: owner ? { provider: s.provider, model: s.model, sourceChatId: s.sourceChatId } : null,
  };
}

export async function requireOwnedStory(id: string, user: SafeUser): Promise<Story> {
  const s = await prisma.story.findUnique({ where: { id } });
  if (!s || s.authorId !== user.id) throw new ApiError(404, "Story not found");
  return s;
}

export function storySearchWhere(q: string | undefined): Prisma.StoryWhereInput | undefined {
  if (!q) return undefined;
  const s = q.trim().slice(0, 80);
  if (!s) return undefined;
  return { OR: [{ title: { contains: s } }, { summary: { contains: s } }, { tags: { contains: s } }] };
}

export function storyToMarkdown(s: Story, chapters: StoryChapter[]) {
  const head = [`# ${s.title}`, "", s.summary ? `_${s.summary}_` : "", "", `Genre: ${s.genre} · Tone: ${s.tone} · ${s.wordCount} words`, ""].join("\n");
  const body = chapters.map((c) => `## ${c.title}\n\n${c.passages.map((p) => p.text).join("\n\n")}`).join("\n\n");
  return `${head}\n${body}\n`;
}
