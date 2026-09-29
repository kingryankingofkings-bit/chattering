import { json, parseBody, route } from "@/lib/api";
import { decryptJson } from "@/lib/crypto";
import { rollEncounter, rollSchema } from "@/lib/encounter";
import { defaultPrefs, type UserPrefs } from "@/lib/types";

/**
 * POST /api/encounter/roll
 * body: { preferences?: {...}, seed?, excludeCharacterIds? }
 * → { character, scenario, openingMessage, hardLimits, context, seed }  |  { match: null, message } when nothing fits
 */
export const POST = route({ policy: "generate" }, async ({ req, user }) => {
  const input = await parseBody(req, rollSchema);
  const prefs = decryptJson<UserPrefs>(user!.prefsEnc, defaultPrefs());
  const result = await rollEncounter({ userId: user!.id, prefs, input });
  if (!result) return json({ match: null, message: "No character matches those preferences. Loosen your filters and try again." });
  return json(result);
});
