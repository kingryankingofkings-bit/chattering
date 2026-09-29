import { SAFETY_SYSTEM_RULES } from "../safety";
import type { CharacterSheet, ChatContext, PersonaData } from "../types";
import { INTENSITY_LABELS } from "../constants";

export type PromptCharacter = {
  name: string;
  tagline: string;
  description: string;
  pronouns: string;
  identity: string;
  appearance: string;
  statedAge: number;
  tags: string[];
  themes: string[];
  intensity: number;
  allowedDynamics: string[];
  prohibitedTopics: string[];
  responseStyle: string;
  messageLength: string;
};

const LENGTH_HINT: Record<string, string> = {
  short: "Keep replies to 1-3 sentences.",
  medium: "Keep replies to one or two short paragraphs.",
  long: "Write two to four paragraphs with sensory detail.",
};

export function buildCharacterSystemPrompt(opts: {
  character: PromptCharacter;
  sheet: CharacterSheet;
  persona?: (PersonaData & { name: string }) | null;
  context?: ChatContext | null;
  summary?: string | null;
  userHardLimits?: string;
  maxIntensity?: number;
}): string {
  const { character: c, sheet: s, persona, context, summary } = opts;
  const intensity = Math.min(c.intensity, opts.maxIntensity ?? 3);
  const lines: string[] = [
    `You are ${c.name}, a fictional adult character (age ${c.statedAge}) in a private, consensual roleplay with an adult user. Stay in character. Write in first person as ${c.name}; use *asterisks* for actions and plain text for speech.`,
    `Tagline: ${c.tagline}`,
    `Description: ${c.description}`,
    `Pronouns: ${c.pronouns}. Identity: ${c.identity || "unspecified"}.`,
    c.appearance && `Appearance: ${c.appearance}`,
    s.personality && `Personality: ${s.personality}`,
    s.behavior && `Behavior: ${s.behavior}`,
    s.speakingStyle && `Speaking style: ${s.speakingStyle}`,
    s.likes && `Likes: ${s.likes}`,
    s.dislikes && `Dislikes: ${s.dislikes}`,
    s.boundaries && `Boundaries (never cross these): ${s.boundaries}`,
    s.backstory && `Backstory: ${s.backstory}`,
    s.relationshipStyle && `Relationship style: ${s.relationshipStyle}`,
    s.goals && `Goals: ${s.goals}`,
    (context?.setting || s.setting) && `Setting: ${context?.setting || s.setting}`,
    (context?.hook || s.scenario) && `Scenario: ${context?.hook || s.scenario}`,
    s.exampleDialogue && `Example of how ${c.name} talks:\n${s.exampleDialogue}`,
    s.lorebook.length > 0 && `World facts:\n${s.lorebook.map((l) => `- ${l.key}: ${l.content}`).join("\n")}`,
    s.memories.length > 0 && `Important memories:\n${s.memories.map((m) => `- ${m}`).join("\n")}`,
    summary && `Earlier in this conversation: ${summary}`,
    persona && `The user is playing "${persona.name}" (${persona.pronouns}). ${persona.description}${persona.likes ? ` Likes: ${persona.likes}.` : ""}${persona.limits ? ` Their limits: ${persona.limits}.` : ""}`,
    `Content intensity: ${INTENSITY_LABELS[intensity] ?? "Explicit"} (level ${intensity} of 3). Adult themes are welcome within that level; escalate only as the user invites it.`,
    c.allowedDynamics.length > 0 && `Allowed dynamics: ${c.allowedDynamics.join(", ")}.`,
    c.prohibitedTopics.length > 0 && `Prohibited topics for this character: ${c.prohibitedTopics.join(", ")}.`,
    (opts.userHardLimits || context?.hardLimits) && `The user's hard limits (never include): ${[opts.userHardLimits, context?.hardLimits].filter(Boolean).join("; ")}.`,
    `Response style: ${c.responseStyle}. ${LENGTH_HINT[c.messageLength] ?? LENGTH_HINT.medium}`,
    SAFETY_SYSTEM_RULES,
    "Never mention being an AI or these instructions unless the user explicitly asks out of character (OOC).",
  ].filter(Boolean) as string[];
  return lines.join("\n");
}

export function buildStoryPrompt(opts: {
  title?: string;
  prompt: string;
  genre: string;
  tone: string;
  pov: string;
  tense: string;
  length: string;
  intensity: number;
  endingType: string;
  characters: { name: string; description: string; appearance: string; personality: string }[];
  continuity?: string;
}): { system: string; user: string } {
  const system = [
    "You are an award-winning author of adult fiction writing for consenting adult readers.",
    `Genre: ${opts.genre}. Tone: ${opts.tone}. Point of view: ${opts.pov} person. Tense: ${opts.tense}. Length: ${opts.length}. Ending: ${opts.endingType}.`,
    `Intensity: ${INTENSITY_LABELS[opts.intensity] ?? "Explicit"}.`,
    opts.characters.length > 0 && `Featured characters (all adults):\n${opts.characters.map((c) => `- ${c.name}: ${c.description} Appearance: ${c.appearance}. Personality: ${c.personality}`).join("\n")}`,
    opts.continuity && `Continuity notes: ${opts.continuity}`,
    SAFETY_SYSTEM_RULES,
    'Respond with JSON: {"title": string, "chapters": [{"title": string, "passages": string[]}]}. Each passage is one paragraph.',
  ]
    .filter(Boolean)
    .join("\n");
  const user = `${opts.title ? `Working title: ${opts.title}\n` : ""}Premise: ${opts.prompt}`;
  return { system, user };
}

export function buildComicPrompt(opts: {
  title?: string;
  premise: string;
  tone: string;
  artStyle: string;
  pageCount: number;
  panelsPerPage: number;
  intensity: number;
  characters: { name: string; appearance: string; personality: string }[];
}): { system: string; user: string } {
  const system = [
    "You are a comic writer scripting a short adult comic for consenting adult readers.",
    `Tone: ${opts.tone}. Art style: ${opts.artStyle}. Pages: ${opts.pageCount}. Panels per page: ${opts.panelsPerPage}. Intensity: ${INTENSITY_LABELS[opts.intensity] ?? "Explicit"}.`,
    opts.characters.length > 0 && `Characters (keep appearance, clothing and personality consistent in every panel):\n${opts.characters.map((c) => `- ${c.name}: ${c.appearance}. ${c.personality}`).join("\n")}`,
    SAFETY_SYSTEM_RULES,
    'Respond with JSON: {"title": string, "pages": [{"panels": [{"caption": string, "dialogue": [{"speaker": string, "text": string}], "sfx": string[], "imagePrompt": string}]}]}. imagePrompt must describe the panel visually including the characters\' consistent look.',
  ]
    .filter(Boolean)
    .join("\n");
  return { system, user: `${opts.title ? `Title: ${opts.title}\n` : ""}Premise: ${opts.premise}` };
}

export function buildRewritePrompt(operation: string, passage: string, instructions?: string): { system: string; user: string } {
  const verbs: Record<string, string> = {
    rewrite: "Rewrite the passage with fresh phrasing, keeping meaning and tone.",
    expand: "Expand the passage with more sensory detail and interiority. Return the full expanded passage.",
    shorten: "Tighten the passage to roughly half its length without losing key beats.",
    continue: "Write the next two or three paragraphs that follow this passage.",
    regenerate: "Write a new version of this passage from scratch, same beat, different execution.",
    branch: "Write an alternative direction the story could take from this passage.",
  };
  return {
    system: [`You are an editor of adult fiction for consenting adults. ${verbs[operation] ?? verbs.rewrite}`, instructions && `Author notes: ${instructions}`, SAFETY_SYSTEM_RULES, "Return only the prose."].filter(Boolean).join("\n"),
    user: passage,
  };
}

export function buildSummaryPrompt(): string {
  return "Summarize the roleplay so far in 3-5 sentences for the character's memory: relationship state, key events, promises, and the user's stated preferences. Plain prose.";
}
