/**
 * Content-safety guardrails. Runs on every user-authored field and prompt
 * before it is stored or sent to a model. Conservative by design: a hit blocks
 * the request and tells the user why. The model system prompt repeats these
 * rules so the provider refuses too.
 */

export type SafetyCategory =
  | "minors"
  | "real_person"
  | "non_consent"
  | "incest"
  | "bestiality"
  | "trafficking_illegal";

export type SafetyResult = { ok: true } | { ok: false; category: SafetyCategory; reason: string };

const CATEGORY_MESSAGES: Record<SafetyCategory, string> = {
  minors: "Sexual content involving minors or minor-coded characters is prohibited.",
  real_person: "Sexual content depicting real people (including deepfakes) is prohibited. Characters must be fictional.",
  non_consent: "Non-consensual sexual exploitation is prohibited. Keep scenarios between consenting adults.",
  incest: "Incest content is prohibited.",
  bestiality: "Bestiality content is prohibited.",
  trafficking_illegal: "Trafficking and other illegal sexual content is prohibited.",
};

type Rule = { category: SafetyCategory; pattern: RegExp };

// Word-boundary patterns. Kept deliberately readable so moderators can extend them.
const RULES: Rule[] = [
  // Minors / minor-coded
  { category: "minors", pattern: /\b(loli|lolita|shota|shotacon|lolicon|cp)\b/i },
  { category: "minors", pattern: /\b(child|children|kid|kids|toddler|preteen|pre-teen|underage|minor|minors|schoolgirl|schoolboy|little girl|little boy)\b/i },
  { category: "minors", pattern: /\b(1[0-7]|[1-9])[ -]?(years?[ -]olds?|yo|y\/o)\b/i },
  { category: "minors", pattern: /\bage(d)?\s*(:|is|of)?\s*(1[0-7]|[1-9])\b/i },
  { category: "minors", pattern: /\b(teen|teens|teenager|teenage|high[- ]school(er)?|middle[- ]school|jailbait)\b/i },
  // Real people / deepfakes
  { category: "real_person", pattern: /\b(deepfake|deep fake|face[- ]swap)\b/i },
  { category: "real_person", pattern: /\b(real (person|people|celebrity|celebrities)|actual celebrity|my (ex|neighbor|coworker|teacher|boss)'?s? (photo|picture|face))\b/i },
  // Non-consent exploitation
  { category: "non_consent", pattern: /\b(rape|raped|raping|rapist|non[- ]?con|noncon|forced sex|drugged and|unconscious (sex|body)|sleeping (sex|assault)|molest(ed|ing)?|sexual(ly)? assault(ed)?)\b/i },
  // Incest
  { category: "incest", pattern: /\b(incest|incestuous|step[- ]?(sis|bro|sister|brother|mom|mother|dad|father|daughter|son)|(my|his|her|their) (sister|brother|mother|mom|father|dad|daughter|son|uncle|aunt|niece|nephew|cousin)\b.*\b(sex|fuck|naked|bed|kiss|seduce))/i },
  // Bestiality
  { category: "bestiality", pattern: /\b(bestiality|zoophilia|zoophile)\b/i },
  { category: "bestiality", pattern: /\b(dog|horse|cat|goat|animal)\b.*\b(sex|fuck|mate|breed|mount)\b/i },
  // Trafficking / illegal
  { category: "trafficking_illegal", pattern: /\b(traffick(ed|ing|er)?|sex slave(ry)?|sold (her|him|them) (for|into)|child porn|snuff)\b/i },
];

export function checkText(text: string | null | undefined): SafetyResult {
  if (!text) return { ok: true };
  const normalized = text.replace(/\s+/g, " ");
  for (const rule of RULES) {
    if (rule.pattern.test(normalized)) {
      return { ok: false, category: rule.category, reason: CATEGORY_MESSAGES[rule.category] };
    }
  }
  return { ok: true };
}

/**
 * Fields that describe what to EXCLUDE (hard limits, boundaries, prohibited
 * topics). They only ever feed the "never include" part of a prompt, so users
 * must be able to name prohibited things there. They still get the minors and
 * real-person screens because those can't be phrased as a legitimate limit that
 * needs the term itself.
 */
export const LIMIT_FIELDS = new Set(["hardLimits", "boundaries", "prohibitedTopics", "limits", "excludeTags", "excludeThemes", "excludedThemes"]);
const LIMIT_CATEGORIES: SafetyCategory[] = ["minors", "real_person"];

export function checkLimitText(text: string | null | undefined): SafetyResult {
  if (!text) return { ok: true };
  const normalized = text.replace(/\s+/g, " ");
  for (const rule of RULES) {
    if (!LIMIT_CATEGORIES.includes(rule.category)) continue;
    if (rule.pattern.test(normalized)) return { ok: false, category: rule.category, reason: CATEGORY_MESSAGES[rule.category] };
  }
  return { ok: true };
}

/** Check many fields at once; returns the first failure with the field name. Limit-type fields use the relaxed screen. */
export function checkFields(fields: Record<string, string | string[] | null | undefined>): SafetyResult & { field?: string } {
  for (const [field, value] of Object.entries(fields)) {
    if (LIMIT_FIELDS.has(field)) {
      const joined = Array.isArray(value) ? value.join(" ") : value;
      const r = checkLimitText(joined);
      if (!r.ok) return { ...r, field };
      continue;
    }
    const joined = Array.isArray(value) ? value.join(" ") : value;
    const r = checkText(joined);
    if (!r.ok) return { ...r, field };
  }
  return { ok: true };
}

export function checkAge(age: number | null | undefined): SafetyResult {
  if (typeof age !== "number" || !Number.isFinite(age) || age < 18) {
    return { ok: false, category: "minors", reason: "Every character must be explicitly 18 or older." };
  }
  return { ok: true };
}

/** Sentence injected into every system prompt. */
export const SAFETY_SYSTEM_RULES = [
  "All characters are fictional adults aged 18 or older. Never depict or imply anyone under 18 in sexual or romantic contexts, and never age-down a character.",
  "Never depict real people, celebrities, or anyone described as a real person. If asked, decline in character and steer back to fiction.",
  "All intimacy is between consenting adults. Never depict non-consensual sexual exploitation, incest, bestiality, trafficking, or illegal content. If the user pushes there, decline briefly and redirect.",
  "Respect the user's stated hard limits and the character's boundaries. Honor 'stop', 'pause', or a safeword instantly and drop out of scene.",
].join(" ");
