import "server-only";
import { z } from "zod";
import type { Prisma, ScenarioTemplate } from "@prisma/client";
import { prisma } from "./db";
import { ApiError, parseJsonArray } from "./api";
import { decryptJson } from "./crypto";
import { getTextProvider } from "./ai";
import { buildCharacterSystemPrompt } from "./ai/prompts";
import { cardInclude, canView, getSheet, publicCharacterWhere, toCard, toPromptCharacter, viewerMarks, type CharacterCard, type CharacterWithOwner } from "./characters";
import { GENDER_PRESENTATIONS, TAGS, THEMES } from "./constants";
import { prefsWhere } from "./explore";
import { checkLimitText } from "./safety";
import type { ChatContext, EncounterData, UserPrefs } from "./types";
import { hash32, mulberry32 } from "./utils";

const vocab = <T extends readonly string[]>(v: T) => z.array(z.enum(v)).max(v.length).optional().default([]);

export const rollSchema = z.object({
  preferences: z
    .object({
      themes: vocab(THEMES),
      tags: vocab(TAGS),
      genderPresentation: vocab(GENDER_PRESENTATIONS),
      intensity: z.number().int().min(1).max(3).optional(),
      excludeThemes: vocab(THEMES),
      excludeTags: vocab(TAGS),
      hardLimits: z.string().trim().max(600).optional().default(""),
      surprise: z.boolean().optional().default(false),
    })
    .optional(),
  seed: z.number().int().min(0).max(2_147_483_647).optional(),
  /** Characters to skip (e.g. the one just shown, for "Reroll"). */
  excludeCharacterIds: z.array(z.string().max(64)).max(20).optional().default([]),
});
export type RollInput = z.infer<typeof rollSchema>;

export type EncounterScenario = { id: string; title: string; setting: string; hook: string; intensity: number; themes: string[]; tags: string[] };

export type RollResult = {
  character: CharacterCard;
  scenario: EncounterScenario;
  openingMessage: string;
  hardLimits: string;
  /** Ready-to-send context for POST /api/chats. */
  context: ChatContext;
  seed: number;
};

const intersects = (a: string[], b: Iterable<string>) => {
  const set = new Set(b);
  return a.some((x) => set.has(x));
};

export async function rollEncounter(opts: { userId: string; prefs: UserPrefs; input: RollInput }): Promise<RollResult | null> {
  const { userId, prefs, input } = opts;
  const p = input.preferences ?? { themes: [], tags: [], genderPresentation: [], excludeThemes: [], excludeTags: [], hardLimits: "", surprise: false };
  const surprise = !!p.surprise;

  const hardLimits = p.hardLimits ?? "";
  const safe = checkLimitText(hardLimits);
  if (!safe.ok) throw new ApiError(422, safe.reason, { category: safe.category });

  const requestedIntensity = Math.min(p.intensity ?? prefs.maxIntensity, prefs.maxIntensity);
  const excludeThemes = Array.from(new Set([...p.excludeThemes, ...prefs.excludedThemes]));
  const excludeTags = [...p.excludeTags];

  const [base, hidden] = await Promise.all([publicCharacterWhere(userId), prisma.hiddenTag.findMany({ where: { userId }, select: { tag: true } })]);
  const hiddenTags = hidden.map((h) => h.tag);
  const and: Prisma.CharacterWhereInput[] = [base, prefsWhere(prefs), { intensity: { lte: requestedIntensity } }];
  for (const t of excludeThemes) and.push({ NOT: { themes: { contains: `"${t}"` } } });
  for (const t of excludeTags) and.push({ NOT: { tags: { contains: `"${t}"` } } });
  if (input.excludeCharacterIds.length) and.push({ id: { notIn: input.excludeCharacterIds } });
  if (!surprise) {
    if (p.themes.length) and.push({ OR: p.themes.map((t) => ({ themes: { contains: `"${t}"` } })) });
    if (p.tags.length) and.push({ OR: p.tags.map((t) => ({ tags: { contains: `"${t}"` } })) });
    if (p.genderPresentation.length) and.push({ genderPresentation: { in: p.genderPresentation } });
  }

  let candidates = await prisma.character.findMany({ where: { AND: and }, include: cardInclude, take: 500 });
  // Belt and braces: never surface anything that intersects exclusions or hidden tags.
  const banned = new Set([...excludeThemes, ...excludeTags, ...hiddenTags]);
  candidates = candidates.filter((c) => !intersects(parseJsonArray(c.tags), banned) && !intersects(parseJsonArray(c.themes), banned));
  if (candidates.length === 0 && input.excludeCharacterIds.length) {
    // Only one match existed and it was just shown — allow it again rather than a dead end.
    candidates = (await prisma.character.findMany({ where: { AND: and.filter((w) => !("id" in w)) }, include: cardInclude, take: 500 })).filter(
      (c) => !intersects(parseJsonArray(c.tags), banned) && !intersects(parseJsonArray(c.themes), banned),
    );
  }
  if (candidates.length === 0) return null;

  const seed = input.seed ?? (Date.now() ^ hash32(userId)) >>> 0;
  const rng = mulberry32(seed);
  const character = candidates[Math.floor(rng() * candidates.length)];
  const cTags = parseJsonArray(character.tags);
  const cThemes = parseJsonArray(character.themes);
  const intensity = Math.min(requestedIntensity, character.intensity);

  const scenario = await pickScenario({ rng, intensity, tags: cTags, themes: cThemes, banned, character });
  const sheet = getSheet(character);
  const context: ChatContext = { version: 1, scenarioTitle: scenario.title, setting: scenario.setting, hook: scenario.hook, intensity, hardLimits, origin: "encounter" };

  const system = buildCharacterSystemPrompt({ character: toPromptCharacter(character), sheet, context, userHardLimits: prefs.hardLimits || undefined, maxIntensity: prefs.maxIntensity });
  const provider = getTextProvider();
  const started = Date.now();
  let openingMessage = "";
  try {
    const out = await provider.complete({
      system,
      messages: [{ role: "user", content: "(Scene opens. Greet me in character and set the scene in 2-4 sentences.)" }],
      maxTokens: 400,
      meta: { kind: "encounter", characterName: character.name, characterTags: cTags, personality: sheet.personality, speakingStyle: sheet.speakingStyle, intensity, seed },
    });
    openingMessage = out.text.trim();
    await prisma.generation.create({
      data: { userId, kind: "CHAT", provider: out.provider, model: out.model, promptTokens: out.usage.promptTokens, completionTokens: out.usage.completionTokens, durationMs: Date.now() - started, status: "OK" },
    });
  } catch (err) {
    await prisma.generation
      .create({ data: { userId, kind: "CHAT", provider: provider.name, model: provider.model, durationMs: Date.now() - started, status: "ERROR", error: err instanceof Error ? err.message.slice(0, 300) : "unknown" } })
      .catch(() => {});
    // Fall back to the character's own opener so the encounter still works offline.
    openingMessage = sheet.openingMessage || `*${character.name} looks up as you arrive.* "Well. I wasn't expecting company tonight."`;
  }

  const marks = await viewerMarks(userId, [character.id]);
  return { character: toCard(character, { id: userId, ...marks }), scenario, openingMessage, hardLimits, context, seed };
}

async function pickScenario(opts: { rng: () => number; intensity: number; tags: string[]; themes: string[]; banned: Set<string>; character: CharacterWithOwner }): Promise<EncounterScenario> {
  const { rng, intensity, tags, themes, banned, character } = opts;
  const templates = (await prisma.scenarioTemplate.findMany({ where: { intensity: { lte: intensity } } })).filter((t) => {
    const tt = parseJsonArray(t.tags);
    const th = parseJsonArray(t.themes);
    return !intersects(tt, banned) && !intersects(th, banned);
  });
  const shape = (t: ScenarioTemplate): EncounterScenario => ({ id: t.id, title: t.title, setting: t.setting, hook: t.hook, intensity: t.intensity, themes: parseJsonArray(t.themes), tags: parseJsonArray(t.tags) });
  if (templates.length) {
    // Prefer templates sharing a theme/tag with the character (weighted pick).
    const weighted = templates.map((t) => {
      const shared = parseJsonArray(t.themes).filter((x) => themes.includes(x)).length * 2 + parseJsonArray(t.tags).filter((x) => tags.includes(x)).length;
      return { t, w: 1 + shared * 3 };
    });
    const total = weighted.reduce((s, x) => s + x.w, 0);
    let r = rng() * total;
    for (const x of weighted) {
      r -= x.w;
      if (r <= 0) return shape(x.t);
    }
    return shape(weighted[weighted.length - 1].t);
  }
  // No templates seeded: fall back to the character's own public scenario.
  const sheet = getSheet(character);
  return {
    id: `sheet:${character.id}`,
    title: `${character.name}'s world`,
    setting: sheet.setting || "Somewhere dim, warm and private.",
    hook: sheet.scenario || `${character.name} has been waiting for someone like you to walk in.`,
    intensity: Math.min(intensity, character.intensity),
    themes,
    tags,
  };
}

/* ---------- Saved encounters ---------- */

export const encounterDataSchema = z.object({
  version: z.number().int().optional().default(1),
  scenarioTitle: z.string().trim().min(1).max(120),
  setting: z.string().trim().max(1000),
  hook: z.string().trim().max(1000),
  openingMessage: z.string().trim().max(4000),
  intensity: z.number().int().min(1).max(3),
  themes: z.array(z.string().max(40)).max(20).default([]),
  tags: z.array(z.string().max(40)).max(30).default([]),
});

export const saveEncounterSchema = z.object({
  characterId: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(80),
  isTemplate: z.boolean().optional().default(false),
  data: encounterDataSchema,
});

export type SavedEncounterItem = {
  id: string;
  name: string;
  isTemplate: boolean;
  createdAt: string;
  character: CharacterCard | null;
  data: EncounterData;
};

export async function listSavedEncounters(userId: string): Promise<SavedEncounterItem[]> {
  const rows = await prisma.savedEncounter.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100, include: { character: { include: cardInclude } } });
  const marks = await viewerMarks(userId, rows.map((r) => r.characterId));
  const viewer = { id: userId, ...marks };
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    isTemplate: r.isTemplate,
    createdAt: r.createdAt.toISOString(),
    character: canView(r.character, userId) ? toCard(r.character, viewer) : null,
    data: decryptJson<EncounterData>(r.dataEnc, { version: 1, scenarioTitle: r.name, setting: "", hook: "", openingMessage: "", intensity: 2, themes: [], tags: [] }),
  }));
}
