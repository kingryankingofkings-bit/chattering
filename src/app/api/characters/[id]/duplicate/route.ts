import { json, route } from "@/lib/api";
import { duplicateCharacter, toFull } from "@/lib/character-write";

/** Copies an owned character as a PRIVATE draft named "<name> (copy)". */
export const POST = route<{ id: string }>({ policy: "write" }, async ({ user, params }) => {
  const c = await duplicateCharacter(user!.id, params.id);
  return json({ id: c.id, character: toFull(c) }, { status: 201 });
});
