import "server-only";
import type { Chat, Character, Message, Persona } from "@prisma/client";
import { prisma } from "./db";
import { decryptJson, decryptString, encryptJson, encryptString } from "./crypto";
import { canView, getSheet, toCard, toPromptCharacter, cardInclude, type CharacterCard } from "./characters";
import { buildCharacterSystemPrompt, buildSummaryPrompt } from "./ai/prompts";
import { getTextProvider, type ChatMessage, type TextRequest } from "./ai";
import { defaultPrefs, type ChatContext, type PersonaData, type UserPrefs } from "./types";
import { ApiError } from "./api";

export const MODEL_WINDOW = 30; // most recent messages sent to the model
export const SUMMARY_EVERY = 24; // roll a memory summary every N messages

export type MessageDto = { id: string; role: string; content: string; createdAt: string; clientId: string | null; model?: string | null; pending?: boolean; error?: string };
export type ChatDto = {
  id: string;
  title: string;
  characterId: string;
  personaId: string | null;
  isPreview: boolean;
  archived: boolean;
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
  context: ChatContext | null;
  character: CharacterCard;
};

export function toMessageDto(m: Message): MessageDto {
  return { id: m.id, role: m.role, content: decryptString(m.contentEnc), createdAt: m.createdAt.toISOString(), clientId: m.clientId, model: m.model };
}

export function toChatDto(chat: Chat & { character: Character & { owner: { id: string; displayName: string } } }, viewerId: string): ChatDto {
  return {
    id: chat.id,
    title: chat.title,
    characterId: chat.characterId,
    personaId: chat.personaId,
    isPreview: chat.isPreview,
    archived: chat.archived,
    messageCount: chat.messageCount,
    lastMessageAt: chat.lastMessageAt.toISOString(),
    createdAt: chat.createdAt.toISOString(),
    context: decryptJson<ChatContext | null>(chat.contextEnc, null),
    character: toCard(chat.character, { id: viewerId }),
  };
}

export async function createChat(opts: { userId: string; characterId: string; personaId?: string | null; context?: ChatContext | null; preview?: boolean; isMod?: boolean }) {
  const character = await prisma.character.findUnique({ where: { id: opts.characterId } });
  if (!character || !canView(character, opts.userId, opts.isMod)) throw new ApiError(404, "Character not found");
  if (!character.ageConfirmed || character.statedAge < 18) throw new ApiError(422, "This character has not been confirmed as an adult");
  const preview = !!opts.preview && character.ownerId === opts.userId;
  if (opts.preview && !preview) throw new ApiError(403, "Only the owner can preview a character");
  const owner = await prisma.user.findUnique({ where: { id: character.ownerId }, select: { id: true } });
  if (!owner) throw new ApiError(404, "Character not found");
  const blocked = await prisma.block.findFirst({ where: { OR: [{ userId: opts.userId, blockedUserId: character.ownerId }, { userId: character.ownerId, blockedUserId: opts.userId }] } });
  if (blocked && character.ownerId !== opts.userId) throw new ApiError(403, "You can't chat with this creator's characters");

  let personaId = opts.personaId ?? null;
  if (personaId) {
    const p = await prisma.persona.findFirst({ where: { id: personaId, userId: opts.userId } });
    if (!p) personaId = null;
  } else {
    const def = await prisma.persona.findFirst({ where: { userId: opts.userId, isDefault: true } });
    personaId = def?.id ?? null;
  }
  const sheet = getSheet(character);
  const chat = await prisma.chat.create({
    data: {
      userId: opts.userId,
      characterId: character.id,
      personaId,
      title: opts.context?.scenarioTitle ? `${character.name} · ${opts.context.scenarioTitle}` : character.name,
      contextEnc: opts.context ? encryptJson(opts.context) : null,
      isPreview: preview,
    },
  });
  const opening = opts.context?.hook && sheet.openingMessage ? sheet.openingMessage : sheet.openingMessage;
  if (opening) {
    await prisma.message.create({ data: { chatId: chat.id, role: "assistant", contentEnc: encryptString(opening), provider: "character", model: "opening" } });
    await prisma.chat.update({ where: { id: chat.id }, data: { messageCount: 1 } });
  }
  if (!preview) await prisma.character.update({ where: { id: character.id }, data: { chatCount: { increment: 1 } } });
  return chat;
}

export async function loadChat(chatId: string, userId: string) {
  const chat = await prisma.chat.findFirst({ where: { id: chatId, userId }, include: { character: { include: cardInclude }, persona: true } });
  if (!chat) throw new ApiError(404, "Chat not found");
  return chat;
}

export async function personaData(p: Persona | null): Promise<(PersonaData & { name: string }) | null> {
  if (!p) return null;
  const d = decryptJson<PersonaData | null>(p.dataEnc, null);
  return d ? { ...d, name: p.name } : null;
}

export async function buildModelRequest(chat: Chat & { character: Character; persona: Persona | null }, userPrefs: UserPrefs, history: Message[]): Promise<TextRequest> {
  const sheet = getSheet(chat.character);
  const context = decryptJson<ChatContext | null>(chat.contextEnc, null);
  const summary = chat.summaryEnc ? decryptString(chat.summaryEnc) : null;
  const persona = await personaData(chat.persona);
  const system = buildCharacterSystemPrompt({
    character: toPromptCharacter(chat.character),
    sheet,
    persona,
    context,
    summary,
    userHardLimits: userPrefs.hardLimits,
    maxIntensity: userPrefs.maxIntensity,
  });
  const messages: ChatMessage[] = history
    .slice(-MODEL_WINDOW)
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: decryptString(m.contentEnc) }));
  if (messages.length === 0 || messages[0].role !== "user") messages.unshift({ role: "user", content: "(The scene begins.)" });
  return {
    system,
    messages,
    maxTokens: chat.character.messageLength === "long" ? 900 : chat.character.messageLength === "short" ? 250 : 500,
    temperature: 0.9,
    meta: { kind: "chat", characterName: chat.character.name, speakingStyle: sheet.speakingStyle, personality: sheet.personality, userName: persona?.name, intensity: chat.character.intensity, seed: history.length },
  };
}

/** Periodically fold older messages into an encrypted memory summary. */
export async function maybeSummarize(chat: Chat, userId: string) {
  if (chat.messageCount === 0 || chat.messageCount % SUMMARY_EVERY !== 0) return;
  const history = await prisma.message.findMany({ where: { chatId: chat.id }, orderBy: { createdAt: "asc" } });
  const prior = chat.summaryEnc ? decryptString(chat.summaryEnc) : "";
  const transcript = history.slice(-SUMMARY_EVERY).map((m) => `${m.role}: ${decryptString(m.contentEnc).slice(0, 400)}`).join("\n");
  const started = Date.now();
  try {
    const out = await getTextProvider().complete({
      system: buildSummaryPrompt(),
      messages: [{ role: "user", content: `${prior ? `Previous summary: ${prior}\n\n` : ""}Transcript:\n${transcript}` }],
      maxTokens: 250,
      temperature: 0.3,
      meta: { kind: "summary" },
    });
    await prisma.chat.update({ where: { id: chat.id }, data: { summaryEnc: encryptString(out.text.slice(0, 2000)) } });
    await prisma.generation.create({ data: { userId, kind: "CHAT", provider: out.provider, model: out.model, promptTokens: out.usage.promptTokens, completionTokens: out.usage.completionTokens, durationMs: Date.now() - started, status: "OK" } });
  } catch (err) {
    console.warn("summary failed", err);
  }
}

export function prefsOf(prefsEnc: string | null): UserPrefs {
  return { ...defaultPrefs(), ...decryptJson<Partial<UserPrefs>>(prefsEnc, {}) };
}
