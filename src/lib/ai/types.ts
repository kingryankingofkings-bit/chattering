/**
 * Provider-agnostic AI interfaces. The app only ever talks to these; swap the
 * implementation with AI_TEXT_PROVIDER / AI_IMAGE_PROVIDER env vars.
 */

export type ChatRole = "system" | "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

/** Hints a provider MAY use (the mock uses them to fake sensible output). */
export type TextMeta = {
  kind: "chat" | "story" | "comic" | "encounter" | "summary" | "rewrite";
  characterName?: string;
  characterTags?: string[];
  personality?: string;
  speakingStyle?: string;
  userName?: string;
  title?: string;
  genre?: string;
  tone?: string;
  pov?: string;
  tense?: string;
  length?: string;
  intensity?: number;
  endingType?: string;
  pageCount?: number;
  panelsPerPage?: number;
  operation?: string;
  seed?: number;
};

export type TextRequest = {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  json?: boolean;
  meta?: TextMeta;
  signal?: AbortSignal;
};

export type TextUsage = { promptTokens: number; completionTokens: number };

export type TextResult = { text: string; usage: TextUsage; model: string; provider: string };

export interface TextProvider {
  readonly name: string;
  readonly model: string;
  complete(req: TextRequest): Promise<TextResult>;
  /** Yields text deltas; the final usage is available after iteration via `result`. */
  stream(req: TextRequest): AsyncGenerator<string, TextResult, void>;
}

export type ImageRequest = {
  prompt: string;
  negativePrompt?: string;
  style?: string;
  orientation?: "portrait" | "landscape" | "square";
  seed?: number;
  /** Description of the character to keep appearance consistent between panels. */
  characterSheet?: string;
  signal?: AbortSignal;
};

export type ImageResult = {
  data: Buffer;
  mime: string;
  width: number;
  height: number;
  seed: number;
  model: string;
  provider: string;
};

export interface ImageProvider {
  readonly name: string;
  readonly model: string;
  generate(req: ImageRequest): Promise<ImageResult>;
}

export function dims(orientation: ImageRequest["orientation"] = "portrait"): { width: number; height: number } {
  if (orientation === "landscape") return { width: 1024, height: 768 };
  if (orientation === "square") return { width: 1024, height: 1024 };
  return { width: 768, height: 1024 };
}

export function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}
