// Typed shapes for the encrypted JSON columns. Bump `version` when a shape
// changes and add a step in migrate-data.ts.

export const CHARACTER_SHEET_VERSION = 1;
export type CharacterSheet = {
  version: number;
  personality: string;
  behavior: string;
  speakingStyle: string;
  likes: string;
  dislikes: string;
  boundaries: string;
  backstory: string;
  relationshipStyle: string;
  goals: string;
  scenario: string;
  setting: string;
  openingMessage: string;
  exampleDialogue: string;
  lorebook: { key: string; content: string }[];
  memories: string[];
};

export const emptySheet = (): CharacterSheet => ({
  version: CHARACTER_SHEET_VERSION,
  personality: "",
  behavior: "",
  speakingStyle: "",
  likes: "",
  dislikes: "",
  boundaries: "",
  backstory: "",
  relationshipStyle: "",
  goals: "",
  scenario: "",
  setting: "",
  openingMessage: "",
  exampleDialogue: "",
  lorebook: [],
  memories: [],
});

export type PersonaData = {
  version: number;
  pronouns: string;
  description: string;
  likes: string;
  limits: string;
};

export type UserPrefs = {
  version: number;
  maxIntensity: number; // 1..3
  blurNsfw: boolean;
  spoilerCovers: boolean;
  preferredThemes: string[];
  excludedThemes: string[];
  hardLimits: string;
  showPublicProfile: boolean;
  allowFollows: boolean;
  discoverableCreations: boolean;
};

export const defaultPrefs = (): UserPrefs => ({
  version: 1,
  maxIntensity: 3,
  blurNsfw: true,
  spoilerCovers: true,
  preferredThemes: [],
  excludedThemes: [],
  hardLimits: "",
  showPublicProfile: true,
  allowFollows: true,
  discoverableCreations: true,
});

export type NotificationPrefs = {
  newFromFollowed: boolean;
  chatReplies: boolean;
  moderationUpdates: boolean;
  productNews: boolean;
};

export const defaultNotificationPrefs = (): NotificationPrefs => ({
  newFromFollowed: true,
  chatReplies: true,
  moderationUpdates: true,
  productNews: false,
});

export type ChatContext = {
  version: number;
  scenarioTitle?: string;
  setting?: string;
  hook?: string;
  intensity?: number;
  hardLimits?: string;
  origin?: "explore" | "encounter" | "preview" | "story" | "comic";
};

export type EncounterData = {
  version: number;
  scenarioTitle: string;
  setting: string;
  hook: string;
  openingMessage: string;
  intensity: number;
  themes: string[];
  tags: string[];
};

export type ComicPanel = {
  id: string;
  caption: string;
  dialogue: { speaker: string; text: string }[];
  sfx: string[];
  imagePrompt: string;
  mediaId: string | null;
};
export type ComicPage = { id: string; panels: ComicPanel[] };

export type StoryChapter = { id: string; title: string; passages: { id: string; text: string }[] };

export type EngagementStats = {
  chats: number;
  messages: number;
  favorites: number;
  rating: number | null;
  ratingCount: number;
  views: number;
};
