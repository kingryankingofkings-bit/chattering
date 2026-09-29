import { route } from "@/lib/api";
import { requireOwnedCharacter, toExport } from "@/lib/character-write";
import { slugify } from "@/lib/utils";

/** Owner-only JSON download of the whole character, private sheet included. */
export const GET = route<{ id: string }>({ policy: "read" }, async ({ user, params }) => {
  const c = await requireOwnedCharacter(params.id, user!.id);
  const body = JSON.stringify(toExport(c), null, 2);
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="character-${slugify(c.name) || c.id}.json"`,
      "cache-control": "no-store",
    },
  });
});
