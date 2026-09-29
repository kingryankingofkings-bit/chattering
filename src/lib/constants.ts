// Shared vocabularies. String "enums" so SQLite stays simple.

export const VISIBILITY = ["PUBLIC", "UNLISTED", "PRIVATE"] as const;
export type Visibility = (typeof VISIBILITY)[number];

export const CONTENT_STATUS = ["DRAFT", "PUBLISHED"] as const;
export const MOD_STATUS = ["ACTIVE", "HIDDEN", "REMOVED"] as const;

export const INTENSITY_LABELS: Record<number, string> = {
  1: "Suggestive",
  2: "Explicit",
  3: "Intense",
};

export const GENDER_PRESENTATIONS = [
  "feminine",
  "masculine",
  "androgynous",
  "nonbinary",
  "fluid",
] as const;

export const ORIENTATIONS = [
  "straight",
  "gay",
  "lesbian",
  "bisexual",
  "pansexual",
  "queer",
  "unspecified",
] as const;

export const PERSONALITIES = [
  "dominant",
  "submissive",
  "switch",
  "playful",
  "tender",
  "brooding",
  "mischievous",
  "commanding",
  "shy",
  "confident",
] as const;

export const ROLE_TYPES = [
  "lover",
  "stranger",
  "rival",
  "mentor",
  "boss",
  "neighbor",
  "royalty",
  "outlaw",
  "companion",
  "artist",
] as const;

export const THEMES = [
  "romance",
  "slow burn",
  "enemies to lovers",
  "forbidden",
  "fantasy",
  "sci-fi",
  "noir",
  "historical",
  "modern",
  "workplace",
  "supernatural",
  "power exchange",
  "friends to lovers",
  "second chance",
  "vacation fling",
] as const;

export const TAGS = [
  "flirty",
  "dominant",
  "submissive",
  "switch",
  "romantic",
  "teasing",
  "gentle",
  "rough",
  "praise",
  "roleplay",
  "vampire",
  "witch",
  "android",
  "knight",
  "pirate",
  "ceo",
  "bartender",
  "dancer",
  "professor",
  "detective",
  "monster",
  "demon",
  "angel",
  "mermaid",
  "elf",
] as const;

export const DYNAMICS = [
  "consensual power exchange",
  "gentle guidance",
  "mutual teasing",
  "slow romance",
  "playful rivalry",
  "aftercare focus",
  "verbal praise",
  "roleplay scenarios",
] as const;

export const ART_STYLES = [
  "noir-ink",
  "painterly",
  "anime",
  "watercolor",
  "neon",
  "vintage-pulp",
  "photoreal",
] as const;

export const PANEL_LAYOUTS = ["grid-4", "grid-6", "strip-3", "splash"] as const;
export const COMIC_TONES = ["sensual", "playful", "dramatic", "dark", "comedic"] as const;
export const ORIENTATION_OPTS = ["portrait", "landscape", "square"] as const;

export const GENRES = [
  "romance",
  "erotica",
  "fantasy",
  "sci-fi",
  "noir",
  "historical",
  "thriller",
  "slice of life",
  "supernatural",
] as const;
export const STORY_LENGTHS = ["flash", "short", "medium", "long"] as const;
export const POVS = ["first", "second", "third"] as const;
export const TENSES = ["past", "present"] as const;
export const ENDINGS = ["happy", "bittersweet", "cliffhanger", "open", "twist"] as const;

export const REPORT_REASONS = [
  "underage or minor-coded content",
  "real person / deepfake",
  "non-consensual exploitation",
  "incest",
  "bestiality",
  "trafficking or illegal content",
  "harassment",
  "spam",
  "other",
] as const;

export const TARGET_TYPES = ["CHARACTER", "COMIC", "STORY", "IMAGE", "USER", "CHAT_MESSAGE"] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

export const MESSAGE_LENGTHS = ["short", "medium", "long"] as const;
export const RESPONSE_STYLES = ["balanced", "descriptive", "dialogue-heavy", "terse"] as const;

export const SORTS = ["recommended", "trending", "newest", "most_chatted", "top_rated", "random"] as const;
export type Sort = (typeof SORTS)[number];

export const PAGE_SIZE = 12;
export const MAX_PINNED = 12;
