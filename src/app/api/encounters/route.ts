import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { canView } from "@/lib/characters";
import { encryptJson } from "@/lib/crypto";
import { listSavedEncounters, saveEncounterSchema } from "@/lib/encounter";
import { checkFields } from "@/lib/safety";
import type { EncounterData } from "@/lib/types";

/** GET /api/encounters → { items: SavedEncounterItem[] } */
export const GET = route({ policy: "read" }, async ({ user }) => json({ items: await listSavedEncounters(user!.id) }));

/** POST /api/encounters { characterId, name, isTemplate?, data: EncounterData } → { id } */
export const POST = route({ policy: "write" }, async ({ req, user }) => {
  const body = await parseBody(req, saveEncounterSchema);
  const safe = checkFields({ name: body.name, scenarioTitle: body.data.scenarioTitle, setting: body.data.setting, hook: body.data.hook, openingMessage: body.data.openingMessage });
  if (!safe.ok) throw new ApiError(422, safe.reason, { category: safe.category, field: safe.field });
  const c = await prisma.character.findUnique({ where: { id: body.characterId } });
  if (!c || !canView(c, user!.id)) throw new ApiError(404, "Character not found");
  const count = await prisma.savedEncounter.count({ where: { userId: user!.id } });
  if (count >= 200) throw new ApiError(400, "You've saved the maximum number of encounters. Delete a few first.");
  const data: EncounterData = { ...body.data, version: 1 };
  const saved = await prisma.savedEncounter.create({ data: { userId: user!.id, characterId: c.id, name: body.name, isTemplate: body.isTemplate, dataEnc: encryptJson(data) } });
  return json({ id: saved.id }, { status: 201 });
});
