import { json, parseBody, route } from "@/lib/api";
import { characterInputSchema } from "@/lib/character-schema";
import { characterStats, deleteCharacter, requireOwnedCharacter, toFull, updateCharacter } from "@/lib/character-write";

/** Owner-only: the full editable character (including the private sheet) plus engagement stats. */
export const GET = route<{ id: string }>({ policy: "read" }, async ({ user, params }) => {
  const c = await requireOwnedCharacter(params.id, user!.id);
  return json({ character: toFull(c), stats: await characterStats(c) });
});

export const PUT = route<{ id: string }>({ policy: "write" }, async ({ req, user, params }) => {
  const input = await parseBody(req, characterInputSchema);
  const c = await updateCharacter(user!.id, params.id, input);
  return json({ character: toFull(c), stats: await characterStats(c) });
});

export const DELETE = route<{ id: string }>({ policy: "write" }, async ({ user, params }) => {
  await deleteCharacter(user!.id, params.id);
  return json({ ok: true });
});
