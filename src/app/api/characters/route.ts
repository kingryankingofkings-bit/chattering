import { json, parseBody, parseQuery, route } from "@/lib/api";
import { characterInputSchema } from "@/lib/character-schema";
import { characterStats, createCharacter, toFull } from "@/lib/character-write";
import { decryptJson } from "@/lib/crypto";
import { exploreQuerySchema, listCharacters } from "@/lib/explore";
import { defaultPrefs, type UserPrefs } from "@/lib/types";

/** GET /api/characters — public catalog search/filter/sort with cursor pagination (see src/lib/explore.ts). */
export const GET = route({ policy: "read" }, async ({ req, user }) => {
  const query = parseQuery(req, exploreQuerySchema);
  const prefs = decryptJson<UserPrefs>(user!.prefsEnc, defaultPrefs());
  return json(await listCharacters({ ...query, viewerId: user!.id, prefs }));
});

/** POST /api/characters — create a character (owner). Validation + safety live in src/lib/character-write.ts. */
export const POST = route({ policy: "write" }, async ({ req, user }) => {
  const input = await parseBody(req, characterInputSchema);
  const c = await createCharacter(user!.id, input);
  return json({ id: c.id, character: toFull(c), stats: await characterStats(c) }, { status: 201 });
});
