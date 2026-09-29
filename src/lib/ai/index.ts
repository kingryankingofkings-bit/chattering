import "server-only";
import { env } from "../env";
import { AnthropicTextProvider } from "./text/anthropic";
import { MockTextProvider } from "./text/mock";
import { OpenAICompatibleTextProvider } from "./text/openai-compatible";
import { MockImageProvider } from "./image/mock";
import { OpenAICompatibleImageProvider } from "./image/openai-compatible";
import type { ImageProvider, TextProvider } from "./types";

export * from "./types";

const g = globalThis as unknown as { __text?: TextProvider; __image?: ImageProvider };

export function getTextProvider(): TextProvider {
  if (g.__text) return g.__text;
  const e = env();
  switch (e.AI_TEXT_PROVIDER) {
    case "openai-compatible":
      g.__text = new OpenAICompatibleTextProvider(e.AI_TEXT_MODEL, e.AI_TEXT_API_KEY, e.AI_TEXT_BASE_URL);
      break;
    case "anthropic":
      g.__text = new AnthropicTextProvider(e.AI_TEXT_MODEL, e.AI_TEXT_API_KEY, e.AI_TEXT_BASE_URL.includes("anthropic") ? e.AI_TEXT_BASE_URL : undefined);
      break;
    default:
      g.__text = new MockTextProvider(e.AI_TEXT_MODEL);
  }
  return g.__text;
}

export function getImageProvider(): ImageProvider {
  if (g.__image) return g.__image;
  const e = env();
  switch (e.AI_IMAGE_PROVIDER) {
    case "openai-compatible":
      g.__image = new OpenAICompatibleImageProvider(e.AI_IMAGE_MODEL, e.AI_IMAGE_API_KEY, e.AI_IMAGE_BASE_URL);
      break;
    default:
      g.__image = new MockImageProvider(e.AI_IMAGE_MODEL);
  }
  return g.__image;
}

/** Test/override hook. */
export function setProviders(p: { text?: TextProvider; image?: ImageProvider }) {
  if (p.text) g.__text = p.text;
  if (p.image) g.__image = p.image;
}
