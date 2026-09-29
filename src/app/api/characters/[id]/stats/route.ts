import { json, route } from "@/lib/api";
import { characterStats, requireOwnedCharacter } from "@/lib/character-write";

/** Owner-only EngagementStats for a character. */
export const GET = route<{ id: string }>({ policy: "read" }, async ({ user, params }) => {
  const c = await requireOwnedCharacter(params.id, user!.id);
  return json(await characterStats(c));
});
