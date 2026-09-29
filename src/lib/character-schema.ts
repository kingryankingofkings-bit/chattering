// Client-safe character builder schema. Shared by the editor form and the
// write API (src/lib/character-write.ts). No server-only imports here.
import { z } from "zod";
import { GENDER_PRESENTATIONS, MESSAGE_LENGTHS, ORIENTATIONS, PERSONALITIES, RESPONSE_STYLES, ROLE_TYPES, VISIBILITY } from "./constants";
import { CHARACTER_SHEET_VERSION, emptySheet, type CharacterSheet } from "./types";

const str = (max: number) => z.string().trim().max(max);

export const lorebookEntrySchema = z.object({ key: str(80), content: str(2000) });

export const characterSheetInputSchema = z.object({
  personality: str(2000),
  behavior: str(2000),
  speakingStyle: str(1000),
  likes: str(1000),
  dislikes: str(1000),
  boundaries: str(1000),
  backstory: str(4000),
  relationshipStyle: str(1000),
  goals: str(1000),
  scenario: str(2000),
  setting: str(2000),
  openingMessage: str(2000),
  exampleDialogue: str(4000),
  lorebook: z.array(lorebookEntrySchema).max(60),
  memories: z.array(str(500)).max(60),
});

export const characterInputSchema = z.object({
  name: str(60).min(1, "Give your character a name"),
  tagline: str(160),
  description: str(2000),
  pronouns: str(40),
  identity: str(200),
  appearance: str(2000),
  avatarMediaId: z.string().max(64).nullable(),
  avatarSeed: str(64),
  statedAge: z.number().int().min(0).max(100000),
  ageConfirmed: z.boolean(),
  fictionConfirmed: z.boolean(),
  tags: z.array(str(32)).max(20),
  themes: z.array(str(40)).max(15),
  genderPresentation: str(40),
  orientation: str(40),
  personalityType: str(40),
  roleType: str(40),
  intensity: z.number().int().min(1).max(3),
  allowedDynamics: z.array(str(60)).max(20),
  prohibitedTopics: z.array(str(80)).max(30),
  responseStyle: z.enum(RESPONSE_STYLES),
  messageLength: z.enum(MESSAGE_LENGTHS),
  visibility: z.enum(VISIBILITY),
  sheet: characterSheetInputSchema,
});

export type CharacterInput = z.infer<typeof characterInputSchema>;
export type CharacterSheetInput = z.infer<typeof characterSheetInputSchema>;

/** Owner-only full character as returned by GET /api/characters/[id]. */
export type CharacterFull = CharacterInput & {
  id: string;
  avatarUrl: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export function emptyCharacterInput(): CharacterInput {
  const { version: _v, ...sheet } = emptySheet();
  void _v;
  return {
    name: "",
    tagline: "",
    description: "",
    pronouns: "they/them",
    identity: "",
    appearance: "",
    avatarMediaId: null,
    avatarSeed: Math.random().toString(36).slice(2, 10),
    statedAge: 25,
    ageConfirmed: false,
    fictionConfirmed: false,
    tags: [],
    themes: [],
    genderPresentation: "",
    orientation: "",
    personalityType: "",
    roleType: "",
    intensity: 2,
    allowedDynamics: [],
    prohibitedTopics: [],
    responseStyle: "balanced",
    messageLength: "medium",
    visibility: "PRIVATE",
    sheet,
  };
}

export function sheetFromInput(s: CharacterSheetInput): CharacterSheet {
  return { ...emptySheet(), ...s, version: CHARACTER_SHEET_VERSION };
}

export const CHARACTER_SELECTS = {
  genderPresentation: GENDER_PRESENTATIONS,
  orientation: ORIENTATIONS,
  personalityType: PERSONALITIES,
  roleType: ROLE_TYPES,
} as const;

/** Labels used by the editor's field-error highlighting (server `field` → section). */
export const FIELD_SECTION: Record<string, string> = {
  name: "basics", tagline: "basics", description: "basics", pronouns: "basics", identity: "basics", appearance: "basics", statedAge: "basics", ageConfirmed: "basics", fictionConfirmed: "basics",
  personality: "personality", behavior: "personality", speakingStyle: "personality", likes: "personality", dislikes: "personality", boundaries: "personality", backstory: "personality", relationshipStyle: "personality", goals: "personality",
  scenario: "scenario", setting: "scenario", openingMessage: "scenario", exampleDialogue: "scenario",
  lorebook: "lore", memories: "lore",
  tags: "content", themes: "content", allowedDynamics: "content", prohibitedTopics: "content",
  visibility: "visibility",
};
