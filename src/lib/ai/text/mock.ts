/**
 * Deterministic offline text provider. Produces in-character replies, story
 * chapters and comic scripts without any network call so the whole app can be
 * exercised end to end. Not meant to be good literature.
 */
import { hash32, mulberry32, pick } from "../../utils";
import { estimateTokens, type TextProvider, type TextRequest, type TextResult } from "../types";

const OPENERS = [
  "A slow smile tugs at the corner of my mouth.",
  "I lean in, close enough that you can feel the warmth of me.",
  "The lights hum low. I let the silence stretch for a heartbeat.",
  "I tilt my head, studying you like a puzzle worth solving.",
  "My fingers trace the rim of the glass before I answer.",
  "There's a flicker of something wicked in my eyes.",
  "I laugh, low and unhurried.",
  "I step closer, my voice dropping to something only you can hear.",
];

const REACTIONS = [
  '"{quote}," I repeat, savoring the words. "You say that like you already know how this ends."',
  '"Mm. {quote}." I let it hang there. "Careful. I remember everything you say to me."',
  'I catch the way you said "{quote}" and I don\'t let it go. "Tell me more. Slowly."',
  '"{quote}?" One brow lifts. "Bold. I like bold."',
  '"You keep surprising me," I murmur. "{quote}... Is that an invitation?"',
];

const CLOSERS = [
  "So. What will you do next?",
  "Your move.",
  "I'm not going anywhere. Take your time.",
  "Say the word and I'll show you exactly what I mean.",
  "Tell me what you want. I'm listening.",
  "The night is young and so is my patience. Barely.",
];

const STORY_PARAS = [
  "The evening settled over the city like a held breath. {A} had promised nothing, and that was the most dangerous promise of all.",
  "{B} found the door unlocked. Inside, candlelight moved across the walls in slow amber waves, and the air smelled of rain and something sweeter.",
  "\"You came,\" {A} said, not turning around. The words were quiet, but they carried the weight of a decision already made.",
  "There was a rule about moments like this, and {B} had spent a long time pretending to believe in it. Tonight the rule felt very far away.",
  "{A} closed the distance in three unhurried steps. A hand found a jaw, tilting it toward the light. \"Look at me. Tell me you want this.\"",
  "\"I want this,\" {B} said, and meant it in a way that frightened and thrilled in equal measure.",
  "The world narrowed to breath and heat and the low, certain rhythm of two people who had stopped pretending.",
  "Later, tangled in sheets that had lost every crease, {A} traced idle shapes over warm skin and thought about how strange it was to feel safe.",
  "Outside, the rain kept its own counsel. Inside, nobody was in any hurry to speak.",
  "\"Stay,\" {A} said at last. It was not a question, and {B} did not treat it as one.",
];

const COMIC_CAPTIONS = [
  "Midnight. The city hums.",
  "Some doors only open once.",
  "A look that lasts a heartbeat too long.",
  "The space between them narrows.",
  "Neither of them says the obvious thing.",
  "Later. Much later.",
];
const COMIC_LINES = [
  "You're late.",
  "I was worth the wait.",
  "Don't make me ask twice.",
  "Careful. I bite.",
  "Then come closer.",
  "Say it again. Slower.",
  "This is a terrible idea.",
  "I know. Isn't it wonderful?",
];
const COMIC_SFX = ["thrum", "hush", "click", "whisper", "creak", "sigh"];

function lastUser(req: TextRequest) {
  for (let i = req.messages.length - 1; i >= 0; i--) if (req.messages[i].role === "user") return req.messages[i].content;
  return "";
}

function chatReply(req: TextRequest, rng: () => number): string {
  const user = lastUser(req);
  const quote = user.replace(/\s+/g, " ").slice(0, 60).replace(/"/g, "'") || "hello";
  const name = req.meta?.characterName ?? "I";
  const style = req.meta?.speakingStyle ? ` ${req.meta.speakingStyle.split(".")[0].trim()}.` : "";
  const parts = [pick(rng, OPENERS), pick(rng, REACTIONS).replace("{quote}", quote), pick(rng, CLOSERS)];
  const wantsStop = /\b(stop|pause|safeword|red)\b/i.test(user);
  if (wantsStop) return `*${name} steps back immediately, the scene dissolving.* Of course. We're out of scene. Take all the time you need, and just say when, if ever, you want to pick things back up.`;
  return parts.join(" ") + (style && rng() > 0.6 ? `\n\n*(${name}'s voice:${style})*` : "");
}

function storyText(req: TextRequest, rng: () => number): string {
  const m = req.meta ?? { kind: "story" as const };
  const A = m.characterName ?? "Vesper";
  const B = m.userName ?? "you";
  const paras = m.length === "flash" ? 3 : m.length === "long" ? 12 : m.length === "medium" ? 8 : 5;
  const chapterCount = m.length === "long" ? 3 : m.length === "medium" ? 2 : 1;
  const chapters = [];
  for (let c = 0; c < chapterCount; c++) {
    const lines: string[] = [];
    for (let i = 0; i < paras; i++) {
      lines.push(pick(rng, STORY_PARAS).replaceAll("{A}", A).replaceAll("{B}", B === "you" ? "you" : B));
    }
    if (c === chapterCount - 1) {
      const end = m.endingType === "cliffhanger" ? "And then the lights went out." : m.endingType === "twist" ? `${A} smiled, and for the first time ${B === "you" ? "you" : B} noticed the second key on the table.` : m.endingType === "bittersweet" ? "By morning the room was empty, and the note said only: soon." : "Morning came slowly, and neither of them minded.";
      lines.push(end);
    }
    chapters.push({ title: chapterCount === 1 ? (m.title ?? "Untitled") : `Chapter ${c + 1}`, passages: lines });
  }
  if (req.json) return JSON.stringify({ title: m.title ?? "Untitled", chapters });
  return chapters.map((c) => `## ${c.title}\n\n${c.passages.join("\n\n")}`).join("\n\n");
}

function comicScript(req: TextRequest, rng: () => number): string {
  const m = req.meta ?? { kind: "comic" as const };
  const pageCount = Math.max(1, Math.min(8, m.pageCount ?? 1));
  const per = Math.max(1, Math.min(6, m.panelsPerPage ?? 4));
  const A = m.characterName ?? "Vesper";
  const B = m.userName ?? "The Stranger";
  const pages = [];
  for (let p = 0; p < pageCount; p++) {
    const panels = [];
    for (let i = 0; i < per; i++) {
      const speaker = rng() > 0.5 ? A : B;
      panels.push({
        caption: rng() > 0.4 ? pick(rng, COMIC_CAPTIONS) : "",
        dialogue: [{ speaker, text: pick(rng, COMIC_LINES) }].concat(rng() > 0.6 ? [{ speaker: speaker === A ? B : A, text: pick(rng, COMIC_LINES) }] : []),
        sfx: rng() > 0.7 ? [pick(rng, COMIC_SFX)] : [],
        imagePrompt: `${m.tone ?? "sensual"} ${m.genre ?? ""} scene, ${A} and ${B}, panel ${i + 1} of page ${p + 1}, ${pick(rng, ["close-up", "wide shot", "over the shoulder", "silhouette", "two-shot"])}`,
      });
    }
    pages.push({ panels });
  }
  return JSON.stringify({ title: m.title ?? "Untitled", pages });
}

function rewrite(req: TextRequest, rng: () => number): string {
  const src = lastUser(req);
  const op = req.meta?.operation ?? "rewrite";
  if (op === "shorten") return src.split(/(?<=[.!?])\s+/).slice(0, Math.max(1, Math.ceil(src.split(/(?<=[.!?])\s+/).length / 2))).join(" ");
  if (op === "expand") return `${src}\n\n${pick(rng, STORY_PARAS).replaceAll("{A}", req.meta?.characterName ?? "She").replaceAll("{B}", "you")}`;
  if (op === "continue") return [pick(rng, STORY_PARAS), pick(rng, STORY_PARAS), pick(rng, STORY_PARAS)].map((s) => s.replaceAll("{A}", req.meta?.characterName ?? "She").replaceAll("{B}", "you")).join("\n\n");
  return src.split(" ").reverse().join(" ").split(" ").reverse().join(" ").replace(/\.$/, "") + (rng() > 0.5 ? ", and the air between them changed." : ". Nothing was the same after that.");
}

function summary(req: TextRequest): string {
  const users = req.messages.filter((m) => m.role === "user").slice(-6).map((m) => m.content.slice(0, 80));
  return `Recent beats: ${users.join(" / ")}`;
}

export class MockTextProvider implements TextProvider {
  readonly name = "mock";
  readonly model: string;
  constructor(model = "mock-roleplay-1") {
    this.model = model;
  }

  private produce(req: TextRequest): string {
    const seedSrc = (req.meta?.seed ?? 0) + ":" + req.messages.map((m) => m.content).join("|").slice(-400) + req.system.slice(0, 100);
    const rng = mulberry32(hash32(seedSrc));
    switch (req.meta?.kind) {
      case "story":
        return storyText(req, rng);
      case "comic":
        return comicScript(req, rng);
      case "rewrite":
        return rewrite(req, rng);
      case "summary":
        return summary(req);
      case "encounter":
        return `${pick(rng, OPENERS)} "Well. Look who wandered into my corner of the night." ${pick(rng, CLOSERS)}`;
      default:
        return chatReply(req, rng);
    }
  }

  async complete(req: TextRequest): Promise<TextResult> {
    const text = this.produce(req);
    return {
      text,
      usage: { promptTokens: estimateTokens(req.system + req.messages.map((m) => m.content).join("")), completionTokens: estimateTokens(text) },
      model: this.model,
      provider: this.name,
    };
  }

  async *stream(req: TextRequest): AsyncGenerator<string, TextResult, void> {
    const result = await this.complete(req);
    const words = result.text.split(/(\s+)/);
    for (const w of words) {
      if (req.signal?.aborted) break;
      yield w;
      await new Promise((r) => setTimeout(r, 12));
    }
    return result;
  }
}
